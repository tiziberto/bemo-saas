# Design System — bemo (CRM para consultorios)

## Product Context
- **What this is:** SaaS CRM para consultorios médicos/dentales chicos: agenda de turnos + fichas de paciente con historia clínica privada.
- **Who it's for:** Recepcionistas (agendan al teléfono, bajo presión) y profesionales (consultan la historia mientras atienden).
- **Space/industry:** Software de gestión clínica. Pares: Dentalink, Doctoralia, Nubimed.
- **Project type:** Web app (dashboard / app shell con calendario).
- **Memorable thing (ancla):** "Esto es confiable" — todo el diseño se subordina a transmitir confianza y velocidad, no decoración.

## Aesthetic Direction
- **Direction:** Quiet clinical (clínica-calma, utilitaria-mínima, neutros cálidos).
- **Decoration level:** Mínima — tipografía y espacio hacen el trabajo; elevación sutil, sin patrones ni gradientes.
- **Mood:** Herramienta seria y serena que respeta el tiempo del usuario. Se siente rápida y segura.
- **Diferenciación deliberada:** La categoría tiende a "cheerful/pastel/cálido" para parecer amigable; nosotros vamos a contracorriente con calma + restraint + legibilidad. Acento teal/petróleo en vez del celeste-salud genérico o el violeta SaaS.

## Typography
- **Display/Hero:** General Sans (Medium/Semibold) — grotesca limpia con identidad propia, evita el Inter/Space Grotesk genérico. Cargar vía Fontshare.
- **Body / UI:** Geist — neutra, moderna, excelente en pantallas de app.
- **UI/Labels:** Geist (igual que body).
- **Data/Tables:** Geist con `font-variant-numeric: tabular-nums` (horarios y números alineados).
- **Code:** Geist Mono.
- **Loading:** General Sans → `https://api.fontshare.com/v2/css?f[]=general-sans@500,600&display=swap`. Geist / Geist Mono → Google Fonts (o self-host).
- **Scale:** 12 / 14 (body 14) / 16 / 17 / 20 / 24 px. Headings weight 600, body 400.

## Color
- **Approach:** Restringido — base neutra + un acento raro y significativo.
- **Primary (acento):** `#0E7C86` (teal/petróleo · confianza médica). Hover `#0B656D`. Tint de fondo `#E1F1F2`, borde tint `#BFE0E2`.
- **Secondary:** Los neutros hacen el trabajo; no hay segundo color de marca.
- **Neutrals:** Fondo `#FBFBFA` · Superficie `#FFFFFF` · Líneas/bordes `#E7E5E1` · Texto muted `#5B6766` · Tinta (texto principal) `#14201F`.
- **Semantic (muted):** success `#2E7D5B` · warning `#B5760A` (tint `#FAF0DC`) · error `#B23A32` · info = el teal `#0E7C86`.
- **Dark mode:** Superficies base `#14201F`, reducir saturación del teal ~15%. (Definir al construir el frontend; MVP arranca light.)

## Spacing
- **Base unit:** 4px.
- **Density:** Cómoda-compacta (la agenda necesita densidad sin agobiar).
- **Scale:** 2xs(2) xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48).

## Layout
- **Approach:** Hybrid — app shell (sidebar izq + topbar con contexto clínica/rol + contenido).
- **Hero por rol:** Recepción → calendario día, columnas por profesional. Profesional → sus turnos del día + historia in-context. Admin → checklist de setup.
- **Grid:** App shell fijo; contenido fluido.
- **Max content width:** Sin límite estricto (app full-width); formularios máx ~640px.
- **Border radius:** sm 6px · md 8px · lg 12px. Nada burbuja (redondeo excesivo = juguete = menos confiable).

## Motion
- **Approach:** Mínimo-funcional. La velocidad se siente como confianza.
- **Easing:** enter ease-out · exit ease-in · move ease-in-out.
- **Duration:** micro 50-100ms · short 150-200ms (default) · medium 250-400ms. Sin coreografías ni scroll-driven.

## Reglas anti-slop (no hacer)
- Nada de violeta/gradientes como acento, grid de 3 columnas con íconos en círculos de color, todo centrado, redondeo burbuja uniforme, Inter/Space Grotesk como primaria, hero con foto stock.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | Sistema "Quiet clinical" creado | /design-consultation; ancla "confiable", research del rubro (capa 3: contracorriente al pastel cheerful) |
| 2026-06-15 | Acento teal `#0E7C86` | Distinción + seriedad vs celeste-salud/violeta SaaS |
| 2026-06-15 | General Sans + Geist | Identidad tipográfica sin caer en Inter/shadcn default |
