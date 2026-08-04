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
npm test                # suite de integración (necesita `docker compose up -d db`)
```

## Tests

La suite levanta la app real contra una base de test que se crea y se migra sola:

```bash
docker compose up -d db
cd apps/api && npm test
```

Cubre la matriz de permisos por rol, el aislamiento entre clínicas, la concurrencia
del anti-doble-turno y los criterios de aceptación de historia clínica y auditoría.
También corre en CI contra un Postgres real.

## Backups

Son datos de salud: el backup es parte del producto, no una tarea pendiente.

```bash
./scripts/backup.sh                                   # dump verificado en ./backups
./scripts/restore.sh backups/<archivo>.dump bemo_test # ensayo (no toca nada sin --yes)
```

Probá el restore contra una base de ensayo al menos una vez por mes: un backup que
nunca se restauró no es un backup.

## Producción

```bash
docker compose -f compose.prod.yaml up -d --build
```

Difiere del compose de desarrollo: imágenes compiladas sin devDependencies y con
usuario sin privilegios, la base sin puerto publicado, las migraciones en un
servicio aparte que corre antes de la API, y nginx sirviendo el front estático con
la API en el mismo origen (así la cookie del refresh token viaja sin CORS).

Variables obligatorias: `JWT_SECRET` (mínimo 32 caracteres — la API **no arranca**
sin ella), `BEMO_APP_PASSWORD` (reemplaza la contraseña de desarrollo del rol de
base de datos), `POSTGRES_*` y `WEB_ORIGIN`.

## Documentación

- [PLAYBOOK.md](PLAYBOOK.md) — cómo replicar este método, la estética y los patrones en otro proyecto.
- [docs/roadmap.md](docs/roadmap.md) — etapas del proyecto.
- [docs/spec-mvp.md](docs/spec-mvp.md) — spec técnico del MVP.
- [DESIGN.md](DESIGN.md) — sistema de diseño.

## Seguridad

- Secretos en `.env` (gitignoreado). Nunca commitear claves.
- `gitleaks` corre en pre-commit y CI (ver `.githooks/pre-commit`).
- Activá el hook local una vez: `git config core.hooksPath .githooks`.
# bemo-saas
