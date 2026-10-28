#!/usr/bin/env bash
# Creates .env from .env.example and fills the empty secrets with random values.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists, leaving it untouched."
  exit 0
fi

secret() { openssl rand -hex "$1"; }

awk -v pg="$(secret 16)" -v key="$(secret 32)" -v tok="$(secret 24)" '
  /^POSTGRES_PASSWORD=$/      { print $0 pg;  next }
  /^N8N_ENCRYPTION_KEY=$/     { print $0 key; next }
  /^PIZZERIA_WEBHOOK_TOKEN=$/ { print $0 tok; next }
  { print }
' .env.example > .env

echo ".env created with random secrets. Review it before starting."
