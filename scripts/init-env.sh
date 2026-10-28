#!/usr/bin/env bash
# Crea el .env a partir de .env.example y rellena los secretos vacios con valores aleatorios.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env ya existe, no se toca."
  exit 0
fi

secreto() { openssl rand -hex "$1"; }

awk -v pg="$(secreto 16)" -v key="$(secreto 32)" -v tok="$(secreto 24)" '
  /^POSTGRES_PASSWORD=$/      { print $0 pg;  next }
  /^N8N_ENCRYPTION_KEY=$/     { print $0 key; next }
  /^PIZZERIA_WEBHOOK_TOKEN=$/ { print $0 tok; next }
  { print }
' .env.example > .env

echo ".env creado con contrasenas aleatorias. Revisalo antes de arrancar."
