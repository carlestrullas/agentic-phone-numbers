#!/usr/bin/env bash
# Restores a backup made with backup.sh.  Usage: scripts/restore.sh backups/<date>
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${1:?Usage: make restore DIR=backups/<date>}"
[ -d "$DIR" ] || { echo "$DIR does not exist"; exit 1; }

read -r -p "This will overwrite the current data with $DIR. Continue? [y/N] " ok
[ "$ok" = "y" ] || exit 1

docker compose stop n8n frontend
for f in "$DIR"/*.sql.gz; do
  db=$(basename "$f" .sql.gz)
  echo "> $db"
  gunzip -c "$f" | docker compose exec -T postgres sh -c "psql -q -U \"\$POSTGRES_USER\" -d $db"
done
docker compose start n8n frontend
echo "Restored."
