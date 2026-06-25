# bemo

CRM SaaS multi-tenant de agenda + fichas de paciente para consultorios médicos/dentales
chicos (Argentina, Ley 25.326).

Stack: **Vue 3 + Node/NestJS + PostgreSQL 16 + Docker Compose**. Auth JWT propio + RLS día 1.

## Getting started (un comando)

Requisitos: Docker + Docker Compose.

```bash
cp .env.example .env      # completá JWT_SECRET y (si la usás) TWENTYFIRST_API_KEY
docker compose up         # levanta db + api + web, migra y siembra datos demo
```

Luego:

| Servicio | URL |
|----------|-----|
| Web (Vue) | http://localhost:5173 |
| API (NestJS) | http://localhost:3000/v1 |
| Healthcheck | http://localhost:3000/v1/health |
| API docs (Swagger) | http://localhost:3000/v1/docs |

La base arranca con migraciones aplicadas y un seed de clínica demo (ver Etapa 4+).

## Estructura

```
apps/
  api/   NestJS + TypeScript (API, migraciones, seed)
  web/   Vue 3 + Vite (frontend)
compose.yaml
docs/    spec, roadmap, diagnóstico de negocio
DESIGN.md  sistema de diseño (fuente de verdad visual)
```

## Comandos útiles (API)

```bash
cd apps/api
npm run migrate:up      # aplicar migraciones
npm run migrate:down    # revertir la última
npm run seed            # sembrar datos demo (idempotente)
npm run start:dev       # API con hot reload
```

## Documentación

- [docs/roadmap.md](docs/roadmap.md) — etapas del proyecto.
- [docs/spec-mvp.md](docs/spec-mvp.md) — spec técnico del MVP.
- [DESIGN.md](DESIGN.md) — sistema de diseño.

## Seguridad

- Secretos en `.env` (gitignoreado). Nunca commitear claves.
- `gitleaks` corre en pre-commit y CI (ver `.githooks/pre-commit`).
- Activá el hook local una vez: `git config core.hooksPath .githooks`.
