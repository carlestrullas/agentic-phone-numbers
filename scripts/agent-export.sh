#!/usr/bin/env bash
# Descarga la configuracion del agente de ElevenLabs (y sus tools) a voice-agent/
# para tenerla versionada. El token del webhook se sustituye por un marcador.
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2-; }
export ELEVENLABS_API_KEY="$(env_get ELEVENLABS_API_KEY)"
export ELEVENLABS_AGENT_ID="$(env_get ELEVENLABS_AGENT_ID)"
export PIZZERIA_WEBHOOK_TOKEN="$(env_get PIZZERIA_WEBHOOK_TOKEN)"
[ -n "$ELEVENLABS_API_KEY" ] && [ -n "$ELEVENLABS_AGENT_ID" ] \
  || { echo "Rellena ELEVENLABS_API_KEY y ELEVENLABS_AGENT_ID en el .env"; exit 1; }

python3 - <<'EOF'
import json, os, re, urllib.request

API = "https://api.elevenlabs.io/v1/convai"
KEY = os.environ["ELEVENLABS_API_KEY"]
TOKEN = os.environ.get("PIZZERIA_WEBHOOK_TOKEN", "")
VOLATILES = {"created_at", "updated_at", "created_at_unix_secs", "updated_at_unix_secs", "access_info"}

def get(path):
    req = urllib.request.Request(f"{API}/{path}", headers={"xi-api-key": KEY})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def limpiar(x):
    if isinstance(x, dict):
        return {k: limpiar(v) for k, v in x.items() if k not in VOLATILES}
    if isinstance(x, list):
        return [limpiar(v) for v in x]
    if isinstance(x, str) and TOKEN and TOKEN in x:
        return x.replace(TOKEN, "${PIZZERIA_WEBHOOK_TOKEN}")
    return x

def guardar(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(limpiar(datos), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("  " + ruta)

agente = get(f"agents/{os.environ['ELEVENLABS_AGENT_ID']}")
guardar("voice-agent/agent.json", agente)

prompt = agente.get("conversation_config", {}).get("agent", {}).get("prompt", {})
if prompt.get("prompt"):
    with open("voice-agent/system-prompt.md", "w", encoding="utf-8") as f:
        f.write(prompt["prompt"].rstrip() + "\n")
    print("  voice-agent/system-prompt.md")

for tool_id in prompt.get("tool_ids", []) or []:
    tool = get(f"tools/{tool_id}")
    nombre = tool.get("tool_config", {}).get("name") or tool_id
    guardar(f"voice-agent/tools/{re.sub(r'[^a-zA-Z0-9_-]+', '-', nombre)}.json", tool)
EOF
echo "Listo. Revisa los cambios y haz commit."
