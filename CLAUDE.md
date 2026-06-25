# bemo — CRM SaaS para consultorios

SaaS multi-tenant de agenda + fichas de paciente para consultorios médicos/dentales chicos (Argentina, Ley 25.326).
Stack: Vue 3 + Node/NestJS + PostgreSQL + Docker Compose. Auth JWT propio + RLS día 1.

Documentos clave:
- `docs/spec-mvp.md` — spec técnico del MVP (modelo de datos, permisos, issues).
- `docs/office-hours-diagnostico.md` — diagnóstico de negocio (demanda, cuña, riesgos).
- `DESIGN.md` — sistema de diseño (fuente de verdad visual).

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
