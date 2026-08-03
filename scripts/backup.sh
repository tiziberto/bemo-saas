#!/usr/bin/env bash
# Backup de la base. Son datos de salud: esto no es opcional.
#
#   ./scripts/backup.sh                  # usa el compose de desarrollo
#   COMPOSE_FILE=compose.prod.yaml ./scripts/backup.sh
#
# Guarda un dump comprimido en ./backups y borra los que superan la retención.
# Cada backup se verifica leyendo su índice: un archivo corrupto no sirve de nada
# y es mejor enterarse ahora que el día que haga falta.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-bemo}"
DB_NAME="${POSTGRES_DB:-bemo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
OUT_DIR="${OUT_DIR:-backups}"

mkdir -p "$OUT_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$OUT_DIR/bemo-$stamp.dump"

echo "[backup] $DB_NAME -> $file"
# Formato custom (-Fc): comprimido y restaurable selectivamente con pg_restore.
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner > "$file"

if [ ! -s "$file" ]; then
  echo "[backup] ERROR: el dump quedó vacío" >&2
  rm -f "$file"
  exit 1
fi

# Verificación: si pg_restore no puede leer el índice, el archivo no sirve.
tables=$(docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_restore --list < "$file" | grep -c "TABLE DATA" || true)
if [ "$tables" -lt 1 ]; then
  echo "[backup] ERROR: el dump no tiene datos de tablas" >&2
  exit 1
fi

size=$(du -h "$file" | cut -f1)
echo "[backup] OK · $size · $tables tablas con datos"

deleted=$(find "$OUT_DIR" -name 'bemo-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')
echo "[backup] retención ${RETENTION_DAYS}d · $deleted archivo(s) viejo(s) borrado(s)"
echo "[backup] total guardado: $(ls -1 "$OUT_DIR"/bemo-*.dump 2>/dev/null | wc -l | tr -d ' ') backups"
