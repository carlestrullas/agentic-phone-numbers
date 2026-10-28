#!/usr/bin/env bash
# Downloads the ElevenLabs agent configuration (and its tools) into voice-agent/
# so it is versioned. The webhook token is replaced with a placeholder.
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2-; }
export ELEVENLABS_API_KEY="$(env_get ELEVENLABS_API_KEY)"
export ELEVENLABS_AGENT_ID="$(env_get ELEVENLABS_AGENT_ID)"
export PIZZERIA_WEBHOOK_TOKEN="$(env_get PIZZERIA_WEBHOOK_TOKEN)"
[ -n "$ELEVENLABS_API_KEY" ] && [ -n "$ELEVENLABS_AGENT_ID" ] \
  || { echo "Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env"; exit 1; }

python3 - <<'EOF'
import json, os, re, urllib.request

API = "https://api.elevenlabs.io/v1/convai"
KEY = os.environ["ELEVENLABS_API_KEY"]
TOKEN = os.environ.get("PIZZERIA_WEBHOOK_TOKEN", "")
VOLATILE = {"created_at", "updated_at", "created_at_unix_secs", "updated_at_unix_secs", "access_info"}

def get(path):
    req = urllib.request.Request(f"{API}/{path}", headers={"xi-api-key": KEY})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def clean(x):
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items() if k not in VOLATILE}
    if isinstance(x, list):
        return [clean(v) for v in x]
    if isinstance(x, str) and TOKEN and TOKEN in x:
        return x.replace(TOKEN, "${PIZZERIA_WEBHOOK_TOKEN}")
    return x

def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(clean(data), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("  " + path)

agent = get(f"agents/{os.environ['ELEVENLABS_AGENT_ID']}")
save("voice-agent/agent.json", agent)

prompt = agent.get("conversation_config", {}).get("agent", {}).get("prompt", {})
if prompt.get("prompt"):
    with open("voice-agent/system-prompt.md", "w", encoding="utf-8") as f:
        f.write(prompt["prompt"].rstrip() + "\n")
    print("  voice-agent/system-prompt.md")

for tool_id in prompt.get("tool_ids", []) or []:
    tool = get(f"tools/{tool_id}")
    name = tool.get("tool_config", {}).get("name") or tool_id
    save(f"voice-agent/tools/{re.sub(r'[^a-zA-Z0-9_-]+', '-', name)}.json", tool)
EOF
echo "Done. Review the changes and commit them."
