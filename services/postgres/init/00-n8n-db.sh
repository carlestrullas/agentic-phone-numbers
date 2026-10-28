#!/bin/sh
# Creates n8n's internal database (separate from the orders database).
# Runs only once, when the Postgres volume is empty.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE n8n;"
