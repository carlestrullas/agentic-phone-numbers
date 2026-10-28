#!/usr/bin/env bash
# Copia de seguridad de las dos bases de datos (pedidos y n8n) en backups/<fecha>/.
# Guarda las ultimas 14 copias.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="backups/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DEST"

for db in "$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)" n8n; do
  docker compose exec -T postgres sh -c "pg_dump -U \"\$POSTGRES_USER\" -d $db --clean --if-exists" \
    | gzip > "$DEST/$db.sql.gz"
done
echo "Copia guardada en $DEST"

ls -1d backups/*/ | sort -r | tail -n +15 | while read -r d; do rm -rf "$d"; done
