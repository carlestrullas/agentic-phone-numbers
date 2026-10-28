#!/bin/sh
# Crea la base de datos interna de n8n (separada de la de pedidos).
# Solo se ejecuta la primera vez, cuando el volumen de Postgres esta vacio.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE n8n;"
