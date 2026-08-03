# Roadmap — bemo (CRM SaaS para consultorios)

> North Star: que la clínica design-partner **use bemo todos los días** y una segunda
> clínica diga "sí, lo pago". Todo lo demás se subordina a eso.
>
> Documentos relacionados: [spec-mvp.md](./spec-mvp.md) · [office-hours-diagnostico.md](./office-hours-diagnostico.md) · [../DESIGN.md](../DESIGN.md)
>
> **Etapas 5 a 8 en detalle:** [plan-desarrollo.md](./plan-desarrollo.md) (qué falta construir, fase por fase)
> y [pricing.md](./pricing.md) (planes y política de precios, ya definidos).

## Cómo leer este roadmap

8 etapas secuenciales con **gates** entre ellas (no se pasa a la siguiente sin cumplir
el criterio de salida). Las etapas 0 y 7 son de **negocio**; las 1-6 son de **producto**.
La regla de oro: no construir de más antes de validar demanda.

| # | Etapa | Tipo | Esfuerzo (solo dev + IA) | Gate de salida |
|---|-------|------|--------------------------|----------------|
| 0 | Validación de demanda | Negocio | 1-2 semanas | Wallet test pasado |
| 1 | Fundaciones técnicas | Producto | 1 semana | `docker compose up` corre todo |
| 2 | Auth + tenant + RLS | Producto | 1-2 semanas | Aislamiento de datos probado |
| 3 | Núcleo de agenda | Producto | 2-3 semanas | Recepción agenda sin choques |
| 4 | Pacientes e historia | Producto | 2-3 semanas | Historia privada + compartir + auditoría |
| 5 | Frontend Vue | Producto | 3-4 semanas | Las 3 vistas por rol usables |
| 6 | Testing y seguridad | Producto | 1-2 semanas | Suite de permisos en verde |
| 7 | Piloto real | Negocio | 4+ semanas | Uso diario + 2da clínica interesada |
| 8 | Monetización y escala | Negocio | continuo | Primeros pagos + boca a boca |

> Total a piloto usable: ~3-4 meses de construcción. Con el gate de la etapa 0 antes.

---

## Etapa 0 — Validación de demanda (ANTES de codear)

**Objetivo:** confirmar que esto se vende antes de invertir 3 meses. Es la tarea que
quedó pendiente de office-hours.

**Qué incluye:**
1. **Test de la billetera**: preguntarle directo a la dentista design-partner: "si te lo
   dejo listo el mes que viene a $X/mes, ¿lo contratás hoy?". Leer si duda.
2. **La pregunta del Excel**: entender qué es lo ÚNICO que el Excel no puede hacer que
   las haría cambiar mañana. Eso define la feature #1.
3. **Conseguir 2 clínicas frías más** dispuestas a ser las primeras (gratis los primeros
   meses a cambio de feedback brutal).
4. **Validar pricing**: testear el precio real (ojo: "$80 caro = problema de valor, no de
   precio"; quizás $10/prof es muy barato). Definir política de inflación (USD cobrado en ARS).

**Entregable:** 1-3 compromisos verbales de pago + feature #1 clara + pricing testeado.

**Gate de salida:** al menos un "sí, lo pago" creíble. Si todos dudan, **frenar y repensar**
antes de construir.

**Skills:** `/office-hours` (ya hecho).

---

## Etapa 1 — Fundaciones técnicas

**Objetivo:** un esqueleto que cualquiera levanta con un comando. La base sobre la que se
monta todo.

**Qué incluye (issue #1 del spec):**
- Docker Compose: `db` (Postgres 16 + `btree_gist`, con healthcheck), `api` (NestJS),
  `web` (Vue), con `depends_on: service_healthy`.
- Skeleton NestJS + TypeScript, estructura modular.
- Sistema de migraciones con **auto-run en dev** + script de **seed de clínica demo**.
- Contrato de error global (RFC 9457 + códigos estables), prefijo `/v1`, paginación.
- OpenAPI/Swagger autogenerado, README con pasos + credenciales demo.
- CI básico + `gitleaks` pre-commit (que la key de 21st.dev nunca se escape).

**Entregable:** `cp .env.example .env && docker compose up` → web en :5173, API en :3000,
DB migrada y con datos demo, Swagger en `/v1/docs`.

**Gate de salida:** un dev nuevo (o vos en una máquina limpia) levanta todo en < 5 min.

**Skills:** `/spec` (hecho) → construir → `/review` → `/ship`.

---

## Etapa 2 — Auth + tenant + RLS + roles

**Objetivo:** la columna vertebral de seguridad. Para datos médicos, esto es lo más crítico.

**Qué incluye (issues #2 + #9-RLS):**
- `register-clinic`, `login`, refresh tokens **rotables y revocables** (cookie httpOnly),
  argon2id con params fijos, rate-limit en login/refresh, invites de un solo uso.
- `AuthProvider` (impl JWT propia, Supabase-ready), UUIDs, `auth_id`.
- **RLS de Postgres día 1**: `SET LOCAL app.current_clinic_id / current_user_id` por request;
  políticas en cada tabla. Guards de app = defensa en profundidad.
- Tabla `user_roles` (admin / professional / receptionist; un usuario puede tener varios).

**Entregable:** registro de clínica, login, y aislamiento por tenant funcionando a nivel DB.

**Gate de salida:** test que siembra 2 clínicas y prueba **cero fuga** entre ellas en todos
los endpoints. Es el gate de seguridad innegociable.

**Skills:** construir → `/cso` (revisión de seguridad) → `/review` → `/ship`.

---

## Etapa 3 — Núcleo de agenda (el corazón del producto)

**Objetivo:** lo que le gana al Excel. Si una etapa define el éxito, es esta.

**Qué incluye (issues #3, #4, #5):**
- Clínica: CRUD de consultorios + invitar equipo (admin).
- Disponibilidad: `availability_blocks` (recurrente, con sala + slot size) + `availability_exceptions`
  (vacaciones/feriados). Cómputo de huecos libres.
- Turnos: booking por la recepción, **anti-doble-turno con constraint `EXCLUDE`/btree_gist**
  (no un chequeo de app), estados (scheduled/confirmed/cancelled/completed/no_show),
  manejo de zona horaria (`timestamptz`), find-or-create de paciente al agendar.

**Entregable:** la recepción ve huecos y agenda un turno; el sistema rechaza choques (409).

**Gate de salida:** test de concurrencia: dos reservas en paralelo al mismo slot → exactamente
un éxito + un 409.

**Skills:** construir → `/review` → `/ship`.

---

## Etapa 4 — Pacientes e historia clínica

**Objetivo:** la privacidad por profesional + compartir, con cumplimiento legal (Ley 25.326).

**Qué incluye (issues #6, #7, #8, #9):**
- Modelo `persons` (identidad por clínica+DNI) + `patient_links` (relación profesional↔persona).
- **Import CSV/Excel** de pacientes (sin migración desde planilla no le ganás al Excel).
- Historia clínica privada (append-only, soft-delete), tipos de entrada.
- Compartir paciente (read, cross-clínica vía política RLS) + consentimientos.
- Auditoría: cada lectura clínica, cada denegación (403), cada login → `audit_log` append-only.

**Entregable:** un profesional gestiona sus pacientes, escribe historia, y comparte en lectura;
otro profesional NO ve lo ajeno; todo queda auditado.

**Gate de salida:** los criterios de aceptación 5-9 del spec pasan.

**Skills:** construir → `/cso` (datos sensibles) → `/review` → `/ship`.

---

## Etapa 5 — Frontend Vue (las pantallas)

**Objetivo:** que se sienta *confiable y rápido* (ancla de DESIGN.md). Esta etapa estaba
bloqueada hasta tener el sistema de diseño — ya está listo.

**Qué incluye (issue #10):**
- Shell de app (sidebar + topbar) aplicando el sistema "Quiet clinical" (teal, General Sans/Geist).
- Vistas por rol con su jerarquía correcta:
  - **Recepción**: agenda día multi-profesional + "buscar hueco" (la pantalla héroe).
  - **Profesional**: sus turnos del día + historia in-context + tratamiento read-only de compartidos.
  - **Admin**: checklist de setup → gestión.
- Todos los estados: loading / empty / error / **conflicto de booking recuperable** / 403-como-ausencia.
- Componentes generados con Magic MCP (21st.dev) respetando DESIGN.md.

**Entregable:** las 3 vistas usables end-to-end contra la API.

**Gate de salida:** `/design-review` sin findings críticos; un humano agenda y atiende sin trabarse.

**Skills:** `/design-html` (opcional, HTML de producción) → construir con Magic MCP → `/design-review` → `/qa`.

---

## Etapa 6 — Testing y seguridad (endurecimiento)

**Objetivo:** que no se filtren datos médicos y que la matriz de permisos sea a prueba de balas.

**Qué incluye (issue #11):**
- **Suite table-driven de autorización**: cada celda de la matriz de permisos, cada 403,
  aislamiento entre clínicas en TODOS los list/get, lectura post-revocación.
- Tests de concurrencia (doble-booking) y de auditoría (toda lectura clínica escribe fila).
- Tests de zona horaria en bordes de día.
- Revisión de seguridad final.

**Entregable:** suite completa en verde + reporte de seguridad limpio.

**Gate de salida:** criterio de aceptación 10 del spec; `/security-review` sin issues abiertos.

**Skills:** `/qa` → `/security-review` → `/cso` → `/review`.

---

## Etapa 7 — Piloto con la clínica real

**Objetivo:** convertir "funciona" en "lo usan todos los días". Acá se aprende lo que ningún test enseña.

**Qué incluye:**
- Deploy a un entorno real (define hosting: VPS, Railway, Fly, etc.) + backups de la DB (PHI).
- Onboarding de la clínica design-partner: cargar su equipo, salas, agenda real, import de pacientes.
- **Sentarse a mirar** a la recepción y a una dentista usarlo, sin ayudar. Anotar cada fricción.
- Loop de feedback semanal → arreglos priorizados.

**Entregable:** la clínica gestiona su semana real en bemo.

**Gate de salida:** uso diario sostenido + al menos **una 2da clínica** pidiendo entrar.
Acá se prende (o no) el boca a boca.

**Skills:** `/land-and-deploy` → `/canary` → `/qa` → `/investigate` (bugs) → `/retro`.

---

## Etapa 8 — Monetización y escala

**Objetivo:** pasar de uso gratis a plata real, y de 1 clínica a muchas.

**Qué incluye:**
- Suscripción + cobro (Mercado Pago para Argentina), pricing definido (per-prof para chicos),
  política de inflación (USD cobrado en ARS).
- Motor de boca a boca: las primeras 3-5 clínicas tan contentas que recomiendan solas.
- Métricas: activación, uso diario, churn.

**Entregable:** primeros pagos recurrentes.

**Gate de salida:** unit economics que cierran (CAC ≈ 0 vía boca a boca, churn bajo).

**Skills:** `/office-hours` (revalidar) → construir cobro → `/ship`.

---

## Post-MVP — Candidatos para v1.1 (priorizados)

Fuera del MVP, pero en orden de valor según las revisiones:
1. **Recordatorios WhatsApp** — marcado por CEO review como el feature MÁS monetizable
   (anti no-show = plata recuperada). Primer candidato.
2. Portal del paciente + reserva online.
3. Multi-clínica por cuenta (para cadenas) → planes per-clínica.
4. Facturación/recetas, obras sociales.
5. Migración a Supabase en producción (el modelo ya está Supabase-ready).

---

## Temas transversales (durante todo el roadmap)

- **Seguridad de datos médicos**: RLS, auditoría, backups, soft-delete. Nunca es "después".
- **Inflación/ARS**: precios en USD cobrados en ARS al cambio.
- **Secretos**: gitleaks activo; rotar la key de 21st.dev expuesta.
- **Compliance Ley 25.326**: consentimiento + auditoría desde el día 1 (ya en el modelo).
- **Decisiones durables**: registrarlas (gstack las guarda) para no re-litigar.
```
