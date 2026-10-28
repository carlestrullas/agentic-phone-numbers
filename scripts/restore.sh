#!/usr/bin/env bash
# Restaura una copia hecha con backup.sh.  Uso: scripts/restore.sh backups/<fecha>
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${1:?Uso: make restore DIR=backups/<fecha>}"
[ -d "$DIR" ] || { echo "No existe $DIR"; exit 1; }

read -r -p "Se sobrescribiran los datos actuales con $DIR. ¿Seguir? [s/N] " ok
[ "$ok" = "s" ] || exit 1

docker compose stop n8n frontend
for f in "$DIR"/*.sql.gz; do
  db=$(basename "$f" .sql.gz)
  echo "> $db"
  gunzip -c "$f" | docker compose exec -T postgres sh -c "psql -q -U \"\$POSTGRES_USER\" -d $db"
done
docker compose start n8n frontend
echo "Restaurado."
