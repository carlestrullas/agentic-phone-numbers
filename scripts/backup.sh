#!/usr/bin/env bash
# Backs up both databases (orders and n8n) into backups/<date>/.
# Keeps the last 14 backups.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="backups/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DEST"

for db in "$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)" n8n; do
  docker compose exec -T postgres sh -c "pg_dump -U \"\$POSTGRES_USER\" -d $db --clean --if-exists" \
    | gzip > "$DEST/$db.sql.gz"
done
echo "Backup saved to $DEST"

ls -1d backups/*/ | sort -r | tail -n +15 | while read -r d; do rm -rf "$d"; done
