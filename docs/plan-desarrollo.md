# Plan de construcción — de "en desarrollo" a vendible

> Escrito el 2026-08-02. Cubre **todo** lo que la pantalla de suscripción marca hoy como
> "En desarrollo", más la infraestructura que esas features necesitan y que hoy no existe.
>
> Relacionados: [pricing.md](./pricing.md) · [roadmap.md](./roadmap.md) · [mejoras-propuestas.md](./mejoras-propuestas.md) · [spec-mvp.md](./spec-mvp.md)

## Qué falta, en números

De las 18 capacidades del catálogo, **10 están sin construir**:

| Plan | Falta |
|---|---|
| **Agenda** ($22.000) | adjuntos · reportes |
| **Portal** ($35.000) | reserva online 24/7 · portal del paciente · cancelar y reprogramar solo |
| **Automático** ($52.000) | recordatorios WhatsApp · agendar por WhatsApp con IA · lista de espera · borrador clínico con IA · aviso de pacientes que dejaron de venir |

Y el cobro no existe: la pantalla de suscripción es una demostración.

**Estimación total: 5 a 6 meses** de construcción (un dev + IA, jornada completa), más un
lead time externo de 2 a 6 semanas para la verificación de Meta que conviene arrancar el
primer día.

---

## Lo que hoy no existe y hace falta para casi todo

El backend es un NestJS contra Postgres crudo, sin una sola llamada de salida a la red.
Nada de esto está:

| Necesidad | Para qué | Decisión |
|---|---|---|
| Cola de jobs | recordatorios, IA, winback, reconciliación de pagos | **pg-boss** — usa el Postgres que ya está, sin sumar Redis. Worker como segundo proceso en compose. |
| Object storage | adjuntos | **S3-compatible**: MinIO en dev (servicio nuevo en compose), Cloudflare R2 en producción. Bucket privado, URLs firmadas de vida corta. |
| Cliente HTTP saliente | WhatsApp, Mercado Pago, Claude | `undici` / fetch nativo con timeout y reintentos. |
| Webhooks entrantes | WhatsApp, Mercado Pago | Necesitan **raw body** para validar la firma HMAC — hoy el `ValidationPipe` global y Express lo descartan. Hay que montar un middleware específico por ruta. |
| Email transaccional | invitaciones, OTP del portal | Resend o SES. Hoy `POST /users/invite` **devuelve el token en la respuesta HTTP**. |
| SDK de IA | borrador clínico, agendar por WhatsApp | `@anthropic-ai/sdk`. |
| Identidad de paciente | portal | Segundo modelo de identidad, separado del staff. Ver Fase D. |
| Tests | todo | **0 archivos, 0 frameworks** hoy. jest + supertest. |
| Logging / errores | todo | pino + Sentry. Hoy un 500 se serializa y **se pierde sin registro**. |

Además, cosas rotas o a medias que hay que arreglar en el camino (van asignadas a su fase):

- La app arranca con `JWT_SECRET = 'dev-insecure-change-me'` si la variable falta. Sin validación de entorno.
- La cookie `refresh_token` se escribe pero **nunca se lee** (no hay `cookie-parser`; `/auth/refresh` lee del body). La sesión muere a los 15 minutos.
- `availability_exceptions` **existe en la base desde la etapa 3 y no la usa nadie**: ni endpoints, ni el cálculo de huecos. Vacaciones y feriados hoy no existen en la práctica.
- El `Dockerfile` del API corre `start:dev` (nest watch), single-stage, `npm install`. No es apto para producción.
- Swagger en `/v1/docs` está expuesto sin autenticación en cualquier entorno.
- El throttler es in-memory: con más de una instancia el límite se multiplica.
- `patient_shares.consent_id` no tiene FK. `clinical_entries` no tiene trigger de `updated_at` y su policy RLS no chequea `clinic_id`.

---

## Orden de construcción

**No sigue la escalera de precios.** Sigue el dinero y las dependencias:

```
A · Cimientos ──► B · Completar plan Agenda ──► C · Cobro real
                                                     │
                          ┌──────────────────────────┘
                          ▼
      E1-E3 · WhatsApp (recordatorios + lista de espera)
                          │
                          ▼
              D · Portal del paciente ──► E4-E6 · IA
```

Por qué WhatsApp antes que el Portal, aunque el Portal sea el plan del medio: los
recordatorios son lo más monetizable según el diagnóstico (anti no-show = plata recuperada),
son **mucho menos código** que el portal, y el trámite con Meta corre en paralelo sin
bloquear a nadie. El Portal, en cambio, abre un modelo de identidad nuevo — es la pieza más
cara y la más riesgosa.

**Definición de terminado de cada fase:** las features que cubre pasan de
`status: 'soon'` a `'available'` en [catalog.ts](../apps/web/src/lib/billing/catalog.ts), y
la pantalla de suscripción deja de decir "En desarrollo" sola.

---

## Fase A — Cimientos · 3-4 semanas

Nada de esto se le muestra al cliente, y sin esto todo lo demás se construye mal.

| # | Qué | Detalle |
|---|---|---|
| A1 | **Suite de tests** | jest + supertest + Postgres de test. La matriz de permisos table-driven (cada rol × cada endpoint), aislamiento entre clínicas en todos los list/get, lectura post-revocación, y el test de concurrencia de doble-booking. Es el gate de la etapa 6 del roadmap, todavía pendiente. |
| A2 | **Endurecimiento del arranque** | Validación de entorno con Zod al boot (que falle si falta `JWT_SECRET`), pino + Sentry, helmet, Swagger detrás de auth en producción, `cookie-parser` + `/auth/refresh` leyendo la cookie. |
| A3 | **Refresh automático de sesión** | Interceptor en `lib/api.ts`: ante 401, refresca una vez y reintenta. Hoy la sesión se corta a los 15 minutos en medio de la consulta. |
| A4 | **Cola de jobs** | pg-boss + proceso `worker` en compose + una migración para su schema. Un job de prueba end-to-end. |
| A5 | **Email transaccional** | Proveedor + plantilla de invitación. El token deja de viajar en la respuesta HTTP. |
| A6 | **Producción** | Dockerfile multi-stage real, deploy (VPS/Fly/Railway), **backups automáticos con restore probado** — son datos de salud, no es opcional. |

**Gate:** `npm test` en verde en CI, la app no arranca sin secretos, un job corre en background y hay un backup restaurado a mano al menos una vez.

---

## Fase B — Completar el plan Agenda · 4-5 semanas

Es lo único que hoy podés cobrar, y ni siquiera está entero.

| # | Qué | Dónde |
|---|---|---|
| B1 | **Excepciones de disponibilidad** (vacaciones, feriados, franjas extra) | La tabla existe. Faltan `POST/GET/DELETE /v1/availability-exceptions`, y **reescribir el SQL de `freeSlots`** para restar los `kind='remove'` y sumar los `kind='add'`. Falta también `DELETE /availability-blocks/:id`. Sumar los CHECK de coherencia que la tabla no tiene. |
| B2 | **Reprogramar y editar turno** | `PATCH /v1/appointments/:id` (hora, profesional, sala, duración, motivo) mapeando el `23P01` a 409 como ya hace `book()`. En el front: arrastrar el turno en la grilla. |
| B3 | **Editar paciente** y `GET /auth/me` completo | `PATCH /v1/patients/:personId`. `/auth/me` devolviendo nombre y clínica — hoy el front adivina el nombre del listado de profesionales y muestra "Mi consultorio" fijo. |
| B4 | **Adjuntos** ⭐ | Migración `attachments` (clinic_id, person_id, uploaded_by, storage_key, mime, size, sha256, deleted_at) con RLS por profesional siguiendo el patrón de `clinical_entries`. Subida directa a storage con URL firmada, límite de tamaño y tipos, antivirus opcional. Lectura vía URL firmada de 5 minutos, **cada acceso al `audit_log`**. UI: adjuntar en la ficha y en la entrada clínica. |
| B5 | **Reportes** ⭐ | Vista nueva `/reportes`: no-show por profesional, ocupación semanal, pacientes nuevos por mes, motivos más frecuentes. SQL agregado directo (el volumen es chico) + índice `appointments(clinic_id, status, starts_at)`. Rango de fechas y export CSV. |
| B6 | **Listar y revocar compartidos** | `GET /v1/patients/:id/shares`. Requisito de Ley 25.326: el consentimiento tiene que poder revocarse, y hoy no se puede sin el `shareId`. |

**Gate:** el plan Agenda cumple todo lo que promete la pantalla de precios. ⭐ = feature del catálogo.

---

## Fase C — Cobro real · 3-4 semanas

| # | Qué | Detalle |
|---|---|---|
| C1 | **Modelo de suscripción** | Migración `subscriptions` (RLS por `clinic_id`) + `subscription_events` append-only, patrón `user_invites` / `audit_log`. Endpoints `GET /v1/billing/catalog`, `GET /v1/billing/subscription`, `POST /v1/billing/change-plan`. |
| C2 | **Reemplazar la fuente mock** | Escribir `apiBillingSource()` y cambiar **una línea** en [source.ts](../apps/web/src/lib/billing/source.ts). La UI no se toca: `demo: false` apaga los avisos solo. El cálculo de precio del backend replica [quote.ts](../apps/web/src/lib/billing/quote.ts) exacto, incluido el único redondeo. |
| C3 | **Mercado Pago** | Suscripción por `preapproval` (monto variable según profesionales). Webhook con verificación de firma y **función `SECURITY DEFINER`**: llega sin JWT y sin contexto de tenant. Job de reconciliación diario. |
| C4 | **Cupos y degradación** | Enforcement del cupo de recepción (1/2/ilimitadas) en `UsersService.invite()` con `code: 'PLAN_LIMIT_REACHED'`. Falta de pago: avisos, después sólo lectura. **Nunca bloquear la agenda** — una clínica que no puede atender no vuelve. |
| C5 | **Facturación** | Factura electrónica ARCA y retenciones de MP (el neto que llega es menor al cobrado). Obligación real antes de cobrarle a nadie. |

**Gate:** una clínica real paga y la factura sale sola.

---

## Fase E1-E3 — WhatsApp · 4-5 semanas (+ lead time de Meta)

> **Arrancar el trámite con Meta el día 1 del plan, no cuando toque esta fase.** Verificación
> de negocio, número de teléfono y aprobación de plantillas tienen tiempos de terceros que no
> controlás (2 a 6 semanas). Twilio queda como salida de emergencia si se traba: más caro,
> pero se activa en un día.

| # | Qué | Detalle |
|---|---|---|
| E1 | **Canal WhatsApp** | Cloud API de Meta. Plantillas categoría *utility* aprobadas (recordatorio, confirmación, hueco liberado). Webhook entrante con validación HMAC sobre raw body. Tabla `messages` para trazabilidad y costos. |
| E2 | **Recordatorios con confirmación** ⭐ | Job diario que arma los envíos de las próximas 24 h; la respuesta del paciente ("1" = confirmo) pasa el turno a `confirmed` sola. Ventana configurable por clínica, opt-out por paciente. Métrica de no-show antes/después: es el argumento de renovación. |
| E3 | **Lista de espera inteligente** ⭐ | Tabla `waitlist` (persona, profesional, franja deseada, prioridad). Al cancelarse un turno, un job ofrece el hueco por orden y lo asigna al primero que acepta, con ventana de expiración. El `EXCLUDE` de la base sigue siendo la red de seguridad contra el doble booking. |

**Nota legal:** mandar nombre y horario de turno a Meta es tratamiento de datos por un tercero.
Consentimiento del paciente y mención en la política de privacidad, antes del primer envío.

**Gate:** una clínica real recibe confirmaciones automáticas y su tasa de no-show baja de forma medible.

---

## Fase D — Portal del paciente · 5-6 semanas

La pieza más cara y la de mayor superficie de ataque: es la primera vez que alguien de afuera
de la clínica entra al sistema.

| # | Qué | Detalle |
|---|---|---|
| D1 | **Identidad de paciente** | Modelo separado del staff, sin excepción. OTP de 6 dígitos por WhatsApp (con fallback a email), token de vida corta con alcance `personId`, GUC nueva `app.current_person_id` + policies RLS propias. Rate limit agresivo y protección contra enumeración de DNI. Cada acceso al `audit_log`. **El paciente nunca ve la historia clínica**, sólo sus turnos e indicaciones. |
| D2 | **Reserva online 24/7** ⭐ | Página pública por clínica (slug), sin login para ver huecos. Reglas configurables: anticipación mínima/máxima, qué profesionales se publican, si hace falta aprobación. Rate limit + captcha. Reusa el mismo `POST /appointments` — el `EXCLUDE` sigue siendo la garantía. |
| D3 | **El paciente consulta sus turnos** ⭐ | Sus próximos turnos, indicaciones previas, dirección y cómo llegar. |
| D4 | **Cancela y reprograma solo** ⭐ | Con las reglas de la clínica (hasta N horas antes). Cancelar dispara la lista de espera de E3. Depende de B2. |

**Gate:** un paciente saca, mueve y cancela un turno sin llamar por teléfono, y la recepción se entera sola.

---

## Fase E4-E6 — IA · 3-4 semanas

| # | Qué | Detalle |
|---|---|---|
| E4 | **Aviso de pacientes que dejaron de venir** ⭐ | Job mensual: sin turnos hace N meses y sin cancelación reciente. Lista accionable + mensaje sugerido. Es la feature de IA más barata y la que más plata devuelve. |
| E5 | **Agendar por WhatsApp con IA** ⭐ | Claude con tool-use sobre los endpoints que ya existen (`/availability`, `/appointments`). El modelo **nunca escribe en la base directamente**: llama a la misma API con las mismas restricciones. Confirmación explícita del paciente antes de reservar, y salida a humano cuando se traba. |
| E6 | **Borrador de la entrada clínica con IA** ⭐ | **Requiere trabajo legal antes de escribir código**: mandar historia clínica a un tercero exige consentimiento específico, acuerdo de encargado de tratamiento y evaluar transferencia internacional (Ley 25.326). Flag por clínica, **apagado por defecto**, y el borrador siempre lo revisa y guarda el profesional — nunca se escribe solo. |

**Gate:** el plan Automático cumple lo que promete y ninguna feature de IA escribe en la historia clínica sin que un profesional lo apruebe.

---

## Resumen de tiempos

| Fase | Duración | Qué desbloquea |
|---|---|---|
| A · Cimientos | 3-4 semanas | Poder construir el resto sin romper nada |
| B · Plan Agenda completo | 4-5 semanas | Vender el plan de $22.000 sin asteriscos |
| C · Cobro real | 3-4 semanas | Facturar |
| E1-E3 · WhatsApp | 4-5 semanas | El plan de $52.000 y la feature más monetizable |
| D · Portal | 5-6 semanas | El plan de $35.000 |
| E4-E6 · IA | 3-4 semanas | Completar el plan de $52.000 |
| **Total** | **~5-6 meses** | Los tres planes vendibles enteros |

**El camino corto al primer peso son A + B + C: unos 3 meses.** Ahí ya tenés un producto
completo para cobrar, y todo lo demás pasa a ser upsell sobre clientes que ya pagan.

---

## Riesgos, en orden de probabilidad

1. **La verificación de Meta se demora.** Mitigación: arrancarla el día 1 y tener Twilio listo como plan B.
2. **El portal del paciente es más grande de lo que parece.** Es un sistema de autenticación nuevo, no una pantalla. Si el calendario aprieta, se recorta a "ver mis turnos" (D3) y se deja la reserva online para después.
3. **La IA sobre historia clínica se frena por lo legal.** Es la única feature del catálogo que puede quedar bloqueada por algo que no es código. Empezar el análisis legal en la Fase B, no en la E.
4. **Construir cinco meses sin clientes.** El antídoto está en el roadmap y sigue pendiente: el test de la billetera de la etapa 0, ahora con precios concretos para preguntar. Fases A+B+C con una clínica real usándolo todos los días valen más que las seis fases en el vacío.
5. **Costos variables sin control.** WhatsApp cobra por conversación y la IA por token. Antes de E2, un tope de gasto por clínica y una alerta — si no, un plan de $52.000 puede costar más de lo que factura.
