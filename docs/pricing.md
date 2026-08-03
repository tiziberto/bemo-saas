# Pricing — bemo (Argentina)

> Decidido el 2026-08-02. Cierra los dos pendientes que el roadmap dejó abiertos en la
> etapa 8: **pricing definido** y **política de inflación**.
>
> La fuente de verdad ejecutable es [`apps/web/src/lib/billing/catalog.ts`](../apps/web/src/lib/billing/catalog.ts).
> Este documento explica el *por qué*; el catálogo tiene el *cuánto*.
>
> Relacionados: [roadmap.md](./roadmap.md) · [office-hours-diagnostico.md](./office-hours-diagnostico.md) · [mejoras-propuestas.md](./mejoras-propuestas.md)

## La idea en una línea

Se cobra **por profesional registrado**, y la escalera de planes es de automatización:
**ordenás → el paciente se agenda solo → el consultorio se maneja solo.**

---

## Los tres planes

| | **Agenda** | **Portal** | **Automático** |
|---|---|---|---|
| Precio por profesional / mes | **$22.000** | **$35.000** | **$52.000** |
| Para quién | El que hoy vive en Excel | El que se pasa el día atendiendo el teléfono | El que quiere dejar de perseguir pacientes |
| Recepcionistas incluidas | 1 | 2 | ilimitadas |

**Agenda** — agenda multiprofesional con anti-sobreturnos, fichas e historia clínica privada,
compartir en lectura, importación desde Excel/CSV, consultorios, horarios, roles, panel del
día y auditoría de accesos. Suma adjuntos (radiografías y estudios) y reportes de no-show,
ocupación y pacientes nuevos.

**Portal** — todo lo anterior + portal del paciente: reserva online 24/7, consulta de sus
turnos e indicaciones, cancelación y reprogramación con reglas.

**Automático** — todo lo anterior + WhatsApp e IA: recordatorios automáticos con confirmación
que actualiza el turno solo, agendar por WhatsApp con asistente de IA, lista de espera
inteligente, borrador de la entrada clínica con IA, aviso de pacientes que dejaron de venir.
Soporte prioritario.

### Qué existe hoy y qué no

Sólo el plan **Agenda** está construido, y ni siquiera entero: adjuntos y reportes están
pendientes. Todo lo de Portal y Automático es promesa.

Por eso cada capacidad del catálogo lleva `status: 'available' | 'soon'` y la pantalla de
suscripción muestra **"En desarrollo"** en vez de un ✓. No es un detalle cosmético: es la
diferencia entre vender un roadmap y mentir. Cuando una feature se termina, se cambia su
`status` y la UI se actualiza sola.

---

## Reglas de cobro

**Se cobra por usuario activo con rol `professional`.** Un dueño que es admin *y* profesional
cuenta una sola vez. Un admin que no atiende no se cobra. La recepción no paga: cada plan
trae su cupo, y el cupo es una razón concreta para subir de plan (no un ítem suelto en la
factura).

**Descuento por volumen**, sobre el subtotal:

| Profesionales | Descuento | Ejemplo con plan Agenda |
|---|---|---|
| 1 – 2 | — | 2 → $44.000 |
| 3 – 5 | −8 % | 3 → $60.720 · 5 → $101.200 |
| 6 – 9 | −12 % | 6 → $116.160 |
| 10 + | −18 % | 10 → $180.400 |

El porqué: con precio lineal, una clínica de 5 profesionales paga $110.000 y entra justo en
la zona donde este segmento ya rechazó a un incumbente por caro
([office-hours L20](./office-hours-diagnostico.md)). El escalonado deja intacto el precio de
entrada y le da aire a la clínica grande, que es la que más deja.

**Ciclos.** Mensual, o anual pagando 10 meses (2 bonificados). El anual congela el precio 12
meses: en Argentina eso es argumento de venta, no una concesión.

**Prueba: 30 días sin tarjeta.** Con 14 no alcanza — se van en cargar equipo, salas, horarios
e importar pacientes, y el valor recién se ve cuando la agenda tiene datos reales.

**Prorrateo.** Sumar un profesional a mitad de mes se cobra proporcional en el período
siguiente; darlo de baja baja el abono desde el mes que viene. Todavía no está implementado.

---

## Política de inflación

Lo que el roadmap pedía definir:

- **Precio de lista anclado en USD, publicado y cobrado en ARS.** El tipo de cambio de
  referencia lo fija la empresa (no el oficial del día: uno estable, revisado por trimestre).
  A modo de referencia: con un dólar a $1.500, el plan Agenda equivale a ~USD 15 por
  profesional. La hipótesis original del diagnóstico era USD 10 — el salto se justifica por
  lo que el plan incluye hoy, pero conviene revalidarlo con el test de la billetera.
- **Revisión trimestral**: 1/1, 1/4, 1/7 y 1/10. Nunca a mitad de trimestre.
- **Aviso con 30 días** por email y en la pantalla de suscripción antes de cualquier aumento.
- **Cliente nuevo: precio congelado los primeros 3 meses** desde el alta.
- **Anual: precio fijo los 12 meses**, sin excepción.
- Todos los precios se comunican **con IVA incluido**. El segmento es mayormente
  monotributista: el IVA no es crédito fiscal para ellos, es precio. Mostrar "+ IVA" es
  esconder el 21 %.

---

## Cobro (todavía no implementado)

La pantalla `/configuracion/suscripcion` funciona con datos de demostración: el cálculo y los
precios son reales, el cobro no existe. Para conectarlo hace falta:

**Producto / backend**
- Tabla `subscriptions` con RLS (`clinic_id = app_current_clinic()`) + `subscription_events`
  append-only, siguiendo el patrón de `user_invites` y `audit_log`.
- Endpoints `GET /v1/billing/catalog`, `GET /v1/billing/subscription`, `POST /v1/billing/change-plan`.
  El frontend ya consume esa forma: se cambia la fuente en
  [`lib/billing/source.ts`](../apps/web/src/lib/billing/source.ts) y nada más.
- El **webhook de Mercado Pago llega sin JWT y sin contexto de tenant** → necesita una función
  `SECURITY DEFINER`, no `withTenant`.
- El estado de la suscripción **no va en el JWT** (se congela 15 minutos): se lee de la DB.
- Enforcement del cupo de recepcionistas en `UsersService.invite()` con
  `ForbiddenException({ code: 'PLAN_LIMIT_REACHED' })`.
- **Nunca bloquear la agenda por falta de pago.** Degradar a lectura tras N días, avisando
  antes. Una clínica que no puede atender por un problema de cobranza no vuelve.
- El orden de cálculo del precio tiene que replicar exactamente
  [`lib/billing/quote.ts`](../apps/web/src/lib/billing/quote.ts), incluido el único redondeo.

**Fiscal y legal (no está en ningún otro doc del repo)**
- **Factura electrónica** (ARCA, ex-AFIP): obligación real antes de cobrarle a nadie. Definir
  condición frente al IVA y tipo de comprobante.
- **Retenciones y percepciones de Mercado Pago**: el neto que llega es menor al cobrado.
  Impacta el precio, no sólo la contabilidad.
- Alternativa a MP para quien no quiera débito automático: link de pago o transferencia con
  conciliación manual. En este segmento es más común de lo que parece.
- **IA sobre historia clínica** (borrador de entrada, plan Automático): implica mandar datos
  de salud a un tercero. Consentimiento, encargado de tratamiento y transferencia
  internacional según Ley 25.326. Se define **antes** de construirlo, no después.

---

## Decisiones abiertas, para revisar después del piloto

1. **WhatsApp quedó en el plan más caro.** El diagnóstico lo marcaba como *lo más monetizable*
   (anti no-show = plata recuperada). Ponerlo arriba es lo que empuja al plan Automático, pero
   deja al plan de entrada vendiéndose sólo contra el Excel. Si la conversión al plan alto es
   baja, el primer experimento es bajar los recordatorios (no la IA) al plan Portal.
2. **Reportes en el plan base** es generoso: en la mayoría de los SaaS son de tier pago. Se
   decidió así para que Agenda se sienta completo contra una planilla.
3. **El ancla de USD 15** por profesional está sin validar. El test de la billetera de la
   etapa 0 sigue pendiente y ahora tiene un número concreto para preguntar.
4. **Cupo de recepción como palanca de upgrade** (1 / 2 / ilimitadas) puede generar fricción en
   la clínica que atiende mañana y tarde con dos personas distintas. Si aparece seguido, la
   salida es vender recepción adicional suelta: el catálogo ya tiene el campo
   `extraReceptionistPrice`, hoy en `null`.
