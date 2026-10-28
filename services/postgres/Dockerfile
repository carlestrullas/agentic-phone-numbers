FROM postgres:17

# Scripts que se ejecutan solo la primera vez (cuando el volumen esta vacio), por orden:
#   00-n8n-db.sh     -> crea la BD 'n8n'
#   01-pedidos.sql   -> tabla 'pedidos' + trigger de tiempo real (en la BD $POSTGRES_DB)
COPY init/ /docker-entrypoint-initdb.d/
