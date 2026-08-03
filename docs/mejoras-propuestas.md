# Mejoras propuestas — bemo

> Backlog de lo que **falta** después del rediseño del frontend (2026-08-02).
> Orden: por valor para la clínica / esfuerzo. Nada de esto está implementado todavía.
> Relacionado: [roadmap.md](./roadmap.md) · [spec-mvp.md](./spec-mvp.md) · [../DESIGN.md](../DESIGN.md)

## Leyenda

- 🔴 **Bloqueante de uso real** — sin esto la clínica se traba en el día a día.
- 🟡 **Alto valor** — mejora clara, no bloquea.
- 🟢 **Nice to have** — cuando sobre tiempo.
- `API` = necesita endpoint nuevo o cambio en el back. `UI` = sólo frontend.

---

## 1. Huecos que hoy frenan el uso diario

| # | Qué | Por qué | Dónde |
|---|-----|---------|-------|
| 1.1 🔴 | **Reprogramar / editar un turno** (cambiar hora, profesional, sala, duración) | Hoy sólo se puede cancelar y volver a crear: se pierde el motivo y el historial. Es lo que más pasa al teléfono. | `API` `PATCH /appointments/:id` |
| 1.2 🔴 | **Borrar/editar bloques de horario** y **excepciones** (vacaciones, feriados, licencia) | Si una profesional se va una semana, hoy no hay forma de sacar esos huecos. El modelo ya tiene `availability_exceptions`. | `API` `DELETE /availability-blocks/:id`, CRUD de excepciones |
| 1.3 🔴 | **Editar datos del paciente** (teléfono, email, apellido mal cargado) | Los teléfonos cambian; hoy la ficha es de sólo lectura una vez creada. | `API` `PATCH /patients/:personId` |
| 1.4 🔴 | **`GET /auth/me` con nombre y clínica** | El front hoy adivina el nombre desde el listado de profesionales y muestra "Mi consultorio" fijo. | `API` |
| 1.5 🟡 | **Listar y revocar pacientes compartidos** | Compartir funciona pero no se puede ver ni revocar sin el `shareId`. Es un requisito de la Ley 25.326 (consentimiento revocable). | `API` `GET /patients/:id/shares` |
| 1.6 🟡 | **Cambiar contraseña / recuperarla** | No hay forma de recuperar acceso si alguien la olvida. | `API` |
| 1.7 🟡 | **Baja y cambio de rol de usuarios** | Cuando alguien se va del consultorio hay que poder desactivarlo. | `API` |
| 1.8 🟡 | **Turnos de un paciente en su ficha** | Al abrir la historia querés ver "vino 3 veces, faltó 1". | `API` `GET /patients/:id/appointments` |

## 2. Lo que más plata mueve

| # | Qué | Por qué |
|---|-----|---------|
| 2.1 🔴 | **Recordatorios por WhatsApp** (24 h antes, con confirmación) | Marcado en el diagnóstico de negocio como lo más monetizable: cada no-show es plata perdida. Hoy el botón de WhatsApp abre el chat con el texto a mano; el paso siguiente es plantilla + envío automático + registro de "confirmó". `API` + integración (Twilio / WhatsApp Cloud API / Baileys). |
| 2.2 🟡 | **Lista de espera** | Cuando cancelan, el hueco se llena solo: "estos 3 pacientes querían antes". `API` |
| 2.3 🟡 | **Métricas del consultorio** | Tasa de no-show por profesional, ocupación semanal, pacientes nuevos por mes. Es el argumento de renovación del abono. `API` (vista agregada) |
| 2.4 🟢 | **Portal del paciente / reserva online** | Saca trabajo a la recepción, pero abre superficie de seguridad: después del piloto. |

## 3. Agenda (sobre lo ya construido)

| # | Qué | Dónde |
|---|-----|-------|
| 3.1 🟡 | **Vista semana** (7 días × profesional elegido) | `UI` — la grilla ya está preparada, falta el modo |
| 3.2 🟡 | **Arrastrar para mover un turno** (drag & drop) | `UI` + 1.1 |
| 3.3 🟡 | **Sobreturnos deliberados** (encajar una urgencia sobre un horario ocupado, con aviso) | `API` (bypass explícito del `EXCLUDE`, auditado) |
| 3.4 🟡 | **Bloquear un rato de agenda** sin paciente ("almuerzo", "reunión") | `API` |
| 3.5 🟢 | **Filtro por consultorio** y vista "por sala" | `UI` |
| 3.6 🟢 | **Imprimir / exportar el día** en PDF prolijo | `UI` (ya hay estilos de impresión básicos) |
| 3.7 🟢 | **Buscar paciente existente al agendar** (autocompletado por nombre, no sólo DNI) | `API` `GET /persons?search=` con permisos de recepción |

## 4. Ficha y historia clínica

| # | Qué | Dónde |
|---|-----|-------|
| 4.1 🟡 | **Adjuntar archivos** (radiografías, estudios, fotos) | `API` + almacenamiento (S3/R2) + cifrado en reposo |
| 4.2 🟡 | **Odontograma** (si el foco es dental) | `API` + `UI`. Es *la* feature que diferencia contra software genérico |
| 4.3 🟡 | **Campos fijos de ficha**: obra social, nº de afiliado, alergias, antecedentes | `API` (hoy todo va en texto libre) |
| 4.4 🟡 | **Plantillas de entrada clínica** ("control de rutina" precargado) | `UI` |
| 4.5 🟢 | **Exportar la historia de un paciente** (PDF/JSON) | Derecho de acceso, Ley 25.326. `API` |
| 4.6 🟢 | **Importar desde Excel además de CSV** y mapeo de columnas | `UI` + `API` |

## 5. Seguridad y cumplimiento

| # | Qué | Dónde |
|---|-----|-------|
| 5.1 🔴 | **Refresh token automático** en el front | Hoy, cuando vence el access token, se cierra sesión (15 min). El endpoint `/auth/refresh` ya existe. `UI` |
| 5.2 🟡 | **Pantalla de auditoría** para el admin (quién leyó qué historia y cuándo) | La tabla `audit_log` ya se llena. `API` `GET /audit-log` |
| 5.3 🟡 | **Bloqueo de sesión por inactividad** | Las pantallas quedan abiertas en el mostrador. `UI` |
| 5.4 🟡 | **Backups automáticos + restore probado** | Son datos de salud: es innegociable antes del piloto. Infra |
| 5.5 🟢 | **2FA para admin** | `API` |

## 6. Calidad y operación

| # | Qué |
|---|-----|
| 6.1 🔴 | **Tests de la matriz de permisos** (etapa 6 del roadmap): cada rol × cada endpoint, aislamiento entre clínicas, lectura post-revocación |
| 6.2 🟡 | **`vue-tsc` en CI**: hoy `vite build` no verifica tipos, sólo transpila |
| 6.3 🟡 | **Tests E2E del circuito de recepción** (Playwright: login → agendar → cancelar) |
| 6.4 🟡 | **Estados de error del servidor caído** con reintento en el front |
| 6.5 🟢 | **Seed de demo real** (`scripts/seed.js` hoy sólo verifica extensiones): clínica, equipo, salas, agenda y pacientes de ejemplo |
| 6.6 🟢 | **Skeletons por vista** en vez de genéricos, y precarga de rutas |

## 7. Producto / negocio

| # | Qué |
|---|-----|
| 7.1 🟡 | **Onboarding guiado** la primera vez (hoy hay checklist en el panel; falta el paso a paso) |
| 7.2 🟡 | **Suscripción y cobro** (Mercado Pago, precio en USD cobrado en ARS) |
| 7.3 🟢 | **Multi-clínica por cuenta** (cadenas) |
| 7.4 🟢 | **PWA / app instalable** para el celular de la recepción |

---

## Sugerencia de orden

1. **Antes del piloto:** 1.1, 1.2, 1.3, 1.4, 5.1, 6.1 — sin eso la clínica se traba o se queda afuera.
2. **Durante el piloto:** 2.1 (WhatsApp), 1.5, 1.8, 3.1, 4.3.
3. **Para cobrar:** 2.3 (métricas), 7.2, 5.4.
