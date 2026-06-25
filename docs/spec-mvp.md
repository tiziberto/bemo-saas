# SPEC (Epic) — CRM SaaS para consultorios médicos · MVP

> Estado: aprobado (post-autoplan) · Stack: Vue 3 + Node (NestJS) + PostgreSQL + Docker Compose
> Mercado inicial: Argentina (Ley 25.326) · Auth: JWT propio + **RLS día 1**

## Contexto

Consultorios médicos chicos/medianos (1–10 profesionales) no tienen una herramienta
simple para gestionar agenda y pacientes respetando la privacidad de la historia
clínica. Hoy usan papel, Excel o WhatsApp. El MVP entrega: una clínica registra su
equipo, configura consultorios y horarios, la recepción agenda turnos, y cada
profesional gestiona sus pacientes con historia clínica privada que puede compartir
puntualmente. Multi-tenant (SaaS).

## Decisiones lockeadas

| #  | Decisión           | Resultado |
|----|--------------------|-----------|
| D1 | Alcance MVP        | Completo (10 issues + fixes de autoplan); sin portal de paciente ni facturación |
| D2 | Paciente           | Persona compartible; historia privada por profesional |
| D6 | Identidad paciente | `persons` (única por clínica+DNI) + `patient_links` por profesional |
| D7 | Compartir          | Solo-lectura, cross-clínica (vía política RLS explícita) |
| D3 | Recepción          | Agenda + datos de contacto, sin historia clínica |
| D4 | País / ley         | Argentina (Ley 25.326) → auditoría de accesos + consentimiento |
| D5 | Multi-clínica      | Una clínica por cuenta |
| D8 | Agenda             | Por profesional + asignación de consultorio por franja |
| D9 | Auth               | JWT propio (access+refresh rotables), Supabase-ready |
| **F6** | Aislamiento    | **RLS de Postgres día 1**; guards de app = defensa en profundidad |

## Roles y matriz de permisos

> Roles vía tabla `user_roles` (un usuario puede tener varios; ej. dueño = admin+professional).

| Acción | Admin | Profesional | Recepcionista |
|---|---|---|---|
| Gestionar clínica, consultorios, usuarios | ✅ | ❌ | ❌ |
| Ver/crear/mover turnos de la clínica | ✅ | Solo los suyos | ✅ (todos) |
| Ver datos de contacto del paciente | ✅ | Sus pacientes | ✅ |
| Ver/editar historia clínica | ❌* | Sus pacientes + compartidos (lectura) | ❌ |
| Compartir un paciente con otro profesional | ❌ | ✅ (los suyos) | ❌ |

*El admin no ve historias clínicas salvo que además tenga rol `professional`.

## Stack

- **Frontend**: Vue 3 + Vite + Pinia + Vue Router + TypeScript. Componentes con Magic MCP (21st.dev).
- **Backend**: Node + NestJS (TypeScript). Guards de permisos + `SET LOCAL` por request para RLS.
- **DB**: PostgreSQL 16 (con extensión `btree_gist` para anti-choque de turnos).
- **Auth**: JWT propio (access corto 5–15 min + refresh rotables/revocables) detrás de
  `AuthProvider`. argon2id (params fijados), rate-limit en login/refresh, invites de un solo uso.
- **Infra**: Docker Compose: `db` (postgres, healthcheck), `api` (node, `depends_on: service_healthy`), `web` (vue).

## Seguridad (PHI · Ley 25.326)

1. **RLS día 1**: políticas en cada tabla. La app setea `app.current_clinic_id` y
   `app.current_user_id` con `SET LOCAL` por transacción (desde los claims del JWT).
   Aislamiento estructural: imposible olvidar un `WHERE clinic_id`.
2. **Guards de app** = defensa en profundidad (no la única línea).
3. **Compartir cross-clínica** = la ÚNICA excepción al aislamiento, expresada como
   política RLS explícita (SELECT permitido si existe `patient_share` activo al usuario actual).
4. **Historia clínica**: solo el profesional dueño o con share activo (lectura).
5. **Auditoría**: cada lectura/escritura de `clinical_entries`, cada share, **cada
   denegación (403) y cada login/login fallido** van a `audit_log` (append-only, post-commit).
6. **Soft-delete** (`deleted_at`) con unique parcial. Retención legal.

## Modelo de datos (núcleo)

```sql
clinics(id UUID PK, name, timezone, created_at)

users(id UUID PK, clinic_id FK, auth_id UUID, email UNIQUE, password_hash,
      full_name, is_active, created_at, updated_at)
user_roles(user_id FK, role 'admin'|'professional'|'receptionist', PRIMARY KEY(user_id, role))
professional_profiles(user_id FK PK, especialidad, matricula)
refresh_tokens(id UUID PK, user_id FK, token_hash, expires_at, revoked_at NULL,
               replaced_by UUID NULL, created_at)   -- rotación + detección de reuso

rooms(id UUID PK, clinic_id FK, name, is_active)

-- Disponibilidad recurrente + excepciones (D8)
availability_blocks(id UUID PK, professional_id FK, room_id FK, weekday 0-6,
                    start_time, end_time, slot_minutes, valid_from, valid_to NULL,
                    CHECK (start_time < end_time))
availability_exceptions(id UUID PK, professional_id FK, date, kind 'add'|'remove',
                        start_time NULL, end_time NULL)   -- vacaciones / feriados / extra

-- Identidad separada de propiedad (fix F1)
persons(id UUID PK, clinic_id FK, dni, first_name, last_name, phone, email NULL,
        birthdate NULL, created_at, updated_at, deleted_at NULL)
        -- UNIQUE(clinic_id, dni) WHERE deleted_at IS NULL
patient_links(id UUID PK, professional_id FK, person_id FK, clinic_id FK,
              notes_admin NULL, created_at, updated_at, deleted_at NULL)
              -- UNIQUE(professional_id, person_id) WHERE deleted_at IS NULL

-- Turnos: anti-choque por constraint de DB (fix F2)
appointments(id UUID PK, clinic_id FK, professional_id FK, room_id FK, person_id FK,
             starts_at timestamptz, ends_at timestamptz,
             status 'scheduled'|'confirmed'|'cancelled'|'completed'|'no_show',
             reason NULL, created_by_user_id FK, created_at, updated_at,
             during tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED)
  -- EXCLUDE USING gist (room_id WITH =, during WITH &&) WHERE status IN ('scheduled','confirmed','completed')
  -- EXCLUDE USING gist (professional_id WITH =, during WITH &&) WHERE status IN ('scheduled','confirmed','completed')

-- Historia clínica: privada del autor (persona)
clinical_entries(id UUID PK, person_id FK, author_professional_id FK, entry_date,
                 type 'note'|'diagnosis'|'treatment'|'prescription', content,
                 created_at, updated_at, deleted_at NULL)   -- append-only

-- Compartir (read, cross-clínica) (D7)
patient_shares(id UUID PK, person_id FK, owner_professional_id FK,
               shared_with_professional_id FK, permission 'read',
               consent_id FK NULL, created_at, revoked_at NULL)   -- re-share = nueva fila

consents(id UUID PK, person_id FK, type 'data_processing'|'sharing', granted_at,
         document_ref NULL, created_by_user_id FK)

-- Auditoría append-only (revocar UPDATE/DELETE al rol api)
audit_log(id UUID PK, clinic_id, actor_user_id, action, resource_type, resource_id,
          decision 'allow'|'deny', details JSONB, ip_address, user_agent,
          request_id, occurred_at)
```

## Edge cases definidos

- **Timezone**: turnos en `timestamptz`; `availability_blocks` en wall-clock resuelto
  contra `clinics.timezone`. Render en tz de la clínica que mira.
- **Desactivar profesional** (`is_active=false`): deja de generar huecos, bloquea nuevas
  reservas, lista turnos futuros para reasignar/cancelar, revoca sus tokens; PHI accesible
  solo vía admin (auditado).
- **Revocar share**: inserta trail inmutable (no des-revoca), auditado, acceso re-chequeado
  server-side en cada lectura.
- **Soft-delete**: unique parcial permite re-alta; define cascada a turnos/entradas.

## Endpoints API (v1)

> Prefijo `/v1`. JSON camelCase. Listados paginados `?page=&pageSize=` → `{data, page, pageSize, total}`.
> Errores RFC 9457 (Problem Details) + `code` estable. 409 para choques de turno.
> Decisión a confirmar en impl: 403 vs 404 para "no es tuyo / otro tenant" (404 no filtra existencia).

- `POST /v1/auth/register-clinic`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- `POST /v1/users/invite`, `GET /v1/users`
- CRUD `/v1/rooms`, `/v1/availability-blocks`, `/v1/availability-exceptions`
- `GET /v1/availability?professionalId=&from=&to=` → `{slots:[...]}`
- CRUD `/v1/appointments`, `GET /v1/appointments?professionalId=&from=&to=`
- CRUD `/v1/patients` (link profesional↔persona; find-or-create por DNI)
- CRUD `/v1/patients/:id/clinical-entries`
- `POST /v1/patients/:id/shares`, `DELETE /v1/patients/:id/shares/:shareId`
- `POST /v1/patients/import` (CSV/Excel — migración desde planilla)

## Epic → Issues hijos (orden sugerido)

```
#1 Fundaciones (Docker Compose 1-comando + healthchecks, Postgres+btree_gist,
   NestJS skeleton, migraciones con auto-run en dev, seed de clínica demo,
   OpenAPI/Swagger, contrato de error global, /v1, gitleaks pre-commit, CI)
        │
        ├─> #2 Auth + tenant + RLS + roles (register-clinic, login, refresh rotables,
        │        AuthProvider, SET LOCAL para RLS, user_roles, rate-limit, invites)
        │        ├─> #3 Clínica: consultorios + usuarios (invitar equipo)
        │        ├─> #4 Disponibilidad + agenda (blocks + exceptions + huecos + slot size)
        │        │        └─> #5 Turnos (booking recepción, EXCLUDE anti-choque, estados, find-or-create persona)
        │        └─> #6 Pacientes (persons + patient_links, CSV import)
        │                 ├─> #7 Historia clínica (privada + auditoría)
        │                 └─> #8 Compartir paciente (read, cross-clínica vía RLS, consentimiento)
        └─> #9 RLS policies + Auditoría (denegaciones+logins) + consentimientos (Ley 25.326)
#10 Frontend Vue: shell + auth + pantallas (REQUIERE design spec previo — ver abajo)
#11 Suite de tests de autorización (matriz de permisos) + concurrencia + auditoría
```

> ⚠️ **#10 bloqueado por diseño**: la revisión de diseño marcó que falta un design spec
> (jerarquía por rol, paradigma de calendario, estados loading/empty/error/conflicto,
> flujo find-or-create paciente, panel de historia in-context, tratamiento read-only de
> compartidos). Correr `/design-consultation` antes de generar componentes.

## Plan de testing (obligatorio)

- **Matriz de autorización (table-driven)**: cada celda de la matriz de permisos, cada 403,
  aislamiento entre 2 clínicas en TODOS los list/get, lectura post-revocación, admin→clínica.
- **Concurrencia**: doble-booking en paralelo → exactamente un 201 + un 409; adyacencia `[)` permitida.
- **Auditoría**: toda lectura clínica escribe fila; toda denegación escribe fila.
- **Timezone**: cómputo de huecos en bordes de día.
- Unit + integración (Postgres real) por módulo + E2E del flujo agendar→atender→compartir.

## Criterios de aceptación (MVP)

1. Clínica se registra y crea admin. 2. Admin crea salas, invita 3 prof + 1 recep.
3. Cada prof configura disponibilidad con sala. 4. Recep ve huecos y agenda; rechaza choques (409).
5. Prof ve solo sus turnos y la historia de SU paciente al atender.
6. Recep ve contacto pero NO historia (403 + auditado). 7. Prof comparte (cross-clínica) en lectura; el otro la ve, no la edita.
8. Otro prof NO ve pacientes ajenos no compartidos (RLS lo bloquea). 9. Todo acceso clínico + denegaciones en `audit_log`.
10. Suite de autorización + concurrencia + auditoría en verde.

## Fuera de alcance (MVP)

- Portal/login del paciente y reserva online · Facturación, recetas formales, obras sociales
- Multi-clínica por cuenta, app móvil · Pago de la suscripción SaaS (a definir)
- **Recordatorios WhatsApp/email** — fuera del MVP, pero marcado por CEO review como el
  feature más monetizable (anti no-show). Candidato #1 para v1.1.

---

## Decision Audit Trail (autoplan)

| # | Fase | Decisión | Tipo | Principio | Resultado |
|---|------|----------|------|-----------|-----------|
| 1 | Eng | Anti-doble-turno con EXCLUDE/btree_gist | Mecánica | P1,P5 | Aplicado |
| 2 | Eng | persons + patient_links (fix F1) | User (D3) | — | Aplicado (usuario: mantener compartir + arreglar) |
| 3 | Eng | RLS día 1 | User (F6) | — | Aplicado (usuario: sí) |
| 4 | Eng | user_roles (admin+professional) | Mecánica | P5 | Aplicado |
| 5 | Eng | updated_at, timestamptz, unique parcial, validaciones agenda | Mecánica | P1 | Aplicado |
| 6 | Eng | refresh rotables, auditar denegaciones/logins, argon2/rate-limit/invites | Mecánica | P1 | Aplicado |
| 7 | Eng | availability slot_minutes + exceptions | Mecánica | P1 | Aplicado |
| 8 | DX | compose 1-comando + healthcheck, seed, migraciones auto, OpenAPI, error contract, /v1, paginación | Mecánica | P1,P5 | Aplicado |
| 9 | CEO | CSV import de pacientes | Mecánica | P1 | Aplicado (al MVP) |
| 10 | CEO | Scope: mantener MVP completo | User (D1) | — | Usuario: mantener |
| 11 | CEO | Auth: mantener JWT propio | User (D9) | — | Usuario: mantener |
| 12 | Design | #10 frontend bloqueado por design spec | Mecánica | P1 | Aplicado (gate) |
| 13 | CEO | Recordatorios WhatsApp | — | P3 | Diferido a v1.1 (fuera de blast radius) |
