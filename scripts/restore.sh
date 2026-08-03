#!/usr/bin/env bash
# Restaura un backup. DESTRUCTIVO: reemplaza por completo la base de destino.
#
#   ./scripts/restore.sh backups/bemo-20260802-140000.dump bemo_restore_test   # ensayo
#   ./scripts/restore.sh backups/bemo-20260802-140000.dump bemo --yes          # de verdad
#
# Sin --yes no toca nada: muestra qué haría y sale.
# Un backup que nunca se restauró no es un backup. Probalo contra una base de
# ensayo al menos una vez por mes.
set -euo pipefail

cd "$(dirname "$0")/.."

file="${1:-}"
target="${2:-}"
confirm="${3:-}"

COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-bemo}"

if [ -z "$file" ] || [ -z "$target" ]; then
  echo "uso: $0 <archivo.dump> <base_destino> [--yes]" >&2
  exit 1
fi
if [ ! -f "$file" ]; then
  echo "[restore] no existe el archivo: $file" >&2
  exit 1
fi

echo "[restore] archivo : $file"
echo "[restore] destino : $target"
echo "[restore] ATENCIÓN: la base '$target' se borra y se vuelve a crear."

if [ "$confirm" != "--yes" ]; then
  echo "[restore] ensayo: no se hizo nada. Repetí el comando con --yes para ejecutarlo."
  exit 0
fi

psql_run() {
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "$1"
}

echo "[restore] recreando la base…"
psql_run "DROP DATABASE IF EXISTS \"$target\" WITH (FORCE)"
psql_run "CREATE DATABASE \"$target\""

echo "[restore] restaurando…"
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_restore -U "$DB_USER" -d "$target" --no-owner --no-privileges < "$file"

echo "[restore] verificando…"
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$target" -t -c \
  "SELECT 'clínicas: ' || (SELECT count(*) FROM clinics)
        || ' · usuarios: ' || (SELECT count(*) FROM users)
        || ' · turnos: ' || (SELECT count(*) FROM appointments)
        || ' · historia: ' || (SELECT count(*) FROM clinical_entries)"

echo "[restore] listo."
