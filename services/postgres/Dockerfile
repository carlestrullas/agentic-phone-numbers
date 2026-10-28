FROM postgres:17

# Scripts run only once (when the volume is empty), in order:
#   00-n8n-db.sh     -> creates the 'n8n' database
#   01-pedidos.sql   -> 'pedidos' (orders) table + real-time trigger (in the $POSTGRES_DB database)
COPY init/ /docker-entrypoint-initdb.d/
