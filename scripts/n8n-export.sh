#!/usr/bin/env bash
# Exporta los workflows del n8n en marcha a n8n/workflows/ (para hacer commit).
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=/tmp/repo-export
docker compose exec -T -u root n8n sh -c "rm -rf $TMP && mkdir -p $TMP/raw && chown -R node $TMP"
docker compose exec -T -u node n8n n8n export:workflow --all --separate --pretty --output="$TMP/raw/" >/dev/null
docker compose cp n8n/scripts/clean-export.js "n8n:$TMP/clean-export.js"
docker compose exec -T -u node n8n node "$TMP/clean-export.js" "$TMP/raw" "$TMP/clean"

rm -f n8n/workflows/*.json
docker compose cp "n8n:$TMP/clean/." n8n/workflows/
docker compose exec -T -u root n8n rm -rf "$TMP"

echo
git status --short n8n/workflows/ 2>/dev/null || true
echo "Listo. Revisa los cambios y haz commit."
