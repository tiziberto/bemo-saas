# Office Hours — Diagnóstico de negocio (CRM para consultorios)

> Sesión YC office-hours · Modo: Startup · Etapa: Pre-producto con design partner real
> Relacionado: [spec-mvp.md](./spec-mvp.md)

## La idea

CRM/SaaS para consultorios médicos y odontológicos chicos y medianos. Gestión de
agenda (la recepción agenda turnos), pacientes e historia clínica privada por
profesional, compartible. Modelo de precio: **$10 USD por profesional/mes**
(~$30/mes para un consultorio de 3 dentistas).

## Evidencia de demanda

| Señal | Estado |
|---|---|
| Consultorio real como design partner (no propio, con acceso) | ✅ Fuerte |
| Una dentista dijo que "querían un software así" | ⚠️ Interés, no demanda |
| Hoy gestionan todo en **Excel** (status quo = competidor real) | ✅ Señal real |
| Rechazaron un incumbente por precio ($80/mes les pareció caro) | ⚠️ Probablemente valor, no precio |
| Plata comprometida / test de la billetera | 🔴 Falta |
| Canal de distribución | 🔴 Sin resolver |

## Status quo (el competidor de verdad)

El competidor no es Dentalink/Doctoralia/Nubimed: es el **Excel**. El producto
tiene que ganarle al Excel en el día 1, no superar en features al incumbente.
Dato clave a investigar: por qué este consultorio (y otros) sigue en Excel
teniendo decenas de opciones en el mercado.

## Cuña (wedge)

Segmento de consultorios chicos, sensibles al precio, **desatendidos por los
incumbentes** que apuntan a clínicas más grandes. Entrada por abajo vía precio
+ simplicidad. El precio es el anzuelo, NO el foso.

## Premisas acordadas

1. El verdadero competidor es el **Excel**, no los softwares grandes. Hay que
   ganarle al Excel el día 1.
2. El **precio bajo no es una ventaja sostenible** (un incumbente puede bajar
   precio). La ventaja real: resolver *su* forma de trabajar mejor que cualquier
   genérico.
3. **Sin un canal de boca a boca que funcione, no escala**, por bueno que sea el
   software. Que las primeras 5 clínicas amen el producto > feature #20.

## Riesgos principales

- **Economía de ticket bajo**: a $30/clínica/mes (~$360/año) hacen falta ~100
  clínicas pagando para ~$3.000/mes. Venta lenta, soporte alto y churn alto en
  SMB. Solo cierra si el costo de adquisición es casi cero.
- **"Caro" = valor, no precio**: para una clínica que factura miles, $80 es
  ruido. Si bajás a $30 sin resolver el dolor, también será "caro".
- **Distribución no resuelta**: "marketing y boca a boca" todavía no es un plan.

## Alternativas de go-to-market

**A. Boca a boca odontológico (recomendada)**
  - Resumen: 3-5 clínicas frías iniciales tratadas como motor de recomendación;
    crecer por la red de dentistas (se conocen, congresos, grupos).
  - Pros: CAC casi cero si el producto entusiasma; encaja con ticket bajo.
  - Cons: solo prende si las primeras 5 están fascinadas, no "conformes".

**B. Canal / partner (colegio de odontólogos, distribuidor, contador)**
  - Resumen: acuerdo con una entidad que ya agrupa consultorios.
  - Pros: acceso a muchas clínicas de una; valida volumen.
  - Cons: depende de cerrar el acuerdo; ciclos largos.

**C. Venta fría 1-a-1**
  - Resumen: llamadas/demos consultorio por consultorio.
  - Pros: control y aprendizaje directo.
  - Cons: no escala a $30/clínica; las cuentas no cierran si es el canal único.

**Recomendación**: A, usando las primeras 3-5 ventas frías como laboratorio +
motor de boca a boca. B como apuesta paralela de alto impacto.

## Señales de founder observadas

- Identificó un problema real con una persona concreta (la dentista).
- Tiene un design partner real (acceso a un consultorio).
- Agencia: ya está construyendo, no solo planeando.
- Pendiente: pensar distribución/escala (lo reconoció).

## La tarea (antes de escribir más código)

1. **Test de la billetera**: preguntarle a la dentista, directo: "si te lo dejo
   listo el mes que viene a $30/mes para las 3, ¿lo contratás hoy?". Leer si
   duda o si dice que sí.
2. **La pregunta del Excel**: entender qué es lo único que el Excel no puede
   hacer que las haría cambiar mañana. Esa es la feature #1 del MVP.
3. **Conseguir 2 clínicas frías más** dispuestas a ser las primeras (gratis los
   primeros meses a cambio de feedback brutal). Construir con 3 clínicas mirando.

## Estado

DONE — diagnóstico aprobado. El MVP técnico ya está specado en
[spec-mvp.md](./spec-mvp.md); este doc es el norte de negocio mientras se construye.
