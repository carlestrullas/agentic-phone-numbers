#!/usr/bin/env bash
# Loads the credentials (from .env) and the workflows in n8n/workflows/ into n8n.
# Existing workflows (same id) are overwritten. Workflows marked as active are activated.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=/tmp/repo-import
run() { docker compose exec -T -u node n8n "$@"; }

docker compose exec -T -u root n8n sh -c "rm -rf $TMP && mkdir -p $TMP"
docker compose cp n8n/workflows/. "n8n:$TMP/workflows"
docker compose cp n8n/scripts/credentials.js "n8n:$TMP/credentials.js"
docker compose exec -T -u root n8n chown -R node "$TMP"

echo "> Credentials"
run sh -c "node $TMP/credentials.js > $TMP/credentials.json && n8n import:credentials --input=$TMP/credentials.json; status=\$?; rm -f $TMP/credentials.json; exit \$status"

echo "> Workflows"
run n8n import:workflow --separate --input="$TMP/workflows"

echo "> Activating workflows"
ACTIVE=$(run node -e '
  const fs = require("fs"), d = process.argv[1];
  for (const f of fs.readdirSync(d)) {
    const wf = JSON.parse(fs.readFileSync(d + "/" + f, "utf8"));
    if (wf.active) console.log(wf.id);
  }' "$TMP/workflows")
for id in $ACTIVE; do
  run n8n publish:workflow --id="$id" >/dev/null 2>&1 \
    || run n8n update:workflow --id="$id" --active=true >/dev/null 2>&1 \
    || echo "  ! Could not activate $id: activate it manually in the editor"
done

docker compose exec -T -u root n8n rm -rf "$TMP"
echo "> Restarting n8n to apply the changes"
docker compose restart n8n >/dev/null
echo "Done."
