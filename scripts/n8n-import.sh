#!/usr/bin/env bash
# Carga en n8n las credenciales (desde el .env) y los workflows de n8n/workflows/.
# Si un workflow ya existe (mismo id) se sobrescribe. Los marcados como activos se activan.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=/tmp/repo-import
run() { docker compose exec -T -u node n8n "$@"; }

docker compose exec -T -u root n8n sh -c "rm -rf $TMP && mkdir -p $TMP"
docker compose cp n8n/workflows/. "n8n:$TMP/workflows"
docker compose cp n8n/scripts/credentials.js "n8n:$TMP/credentials.js"
docker compose exec -T -u root n8n chown -R node "$TMP"

echo "> Credenciales"
run sh -c "node $TMP/credentials.js > $TMP/credentials.json && n8n import:credentials --input=$TMP/credentials.json; status=\$?; rm -f $TMP/credentials.json; exit \$status"

echo "> Workflows"
run n8n import:workflow --separate --input="$TMP/workflows"

echo "> Activando workflows"
ACTIVOS=$(run node -e '
  const fs = require("fs"), d = process.argv[1];
  for (const f of fs.readdirSync(d)) {
    const wf = JSON.parse(fs.readFileSync(d + "/" + f, "utf8"));
    if (wf.active) console.log(wf.id);
  }' "$TMP/workflows")
for id in $ACTIVOS; do
  run n8n publish:workflow --id="$id" >/dev/null 2>&1 \
    || run n8n update:workflow --id="$id" --active=true >/dev/null 2>&1 \
    || echo "  ! No se ha podido activar $id: activalo a mano en el editor"
done

docker compose exec -T -u root n8n rm -rf "$TMP"
echo "> Reiniciando n8n para aplicar los cambios"
docker compose restart n8n >/dev/null
echo "Listo."
