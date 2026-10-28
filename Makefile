# Comandos del proyecto. `make help` para ver la lista.
# Usan `docker compose`, que lee del .env que ficheros de compose cargar (local o servidor).

.DEFAULT_GOAL := help
.PHONY: help init up down restart ps logs tunnel tunnel-url tunnel-down \
        n8n-export n8n-import agent-export backup restore psql

help: ## Muestra esta ayuda
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-13s %s\n", $$1, $$2}'

init: ## Crea el .env con secretos aleatorios
	@scripts/init-env.sh

up: ## Arranca todos los servicios
	docker compose up -d --build

down: ## Para todos los servicios (los datos se mantienen)
	docker compose --profile tunnel down

restart: ## Reinicia todos los servicios
	docker compose restart

ps: ## Estado de los servicios
	docker compose ps

logs: ## Logs en directo (make logs s=n8n para uno solo)
	docker compose logs -f $(s)

tunnel: ## [local] Expone el webhook con un tunel de Cloudflare
	docker compose --profile tunnel up -d
	@$(MAKE) --no-print-directory tunnel-url

tunnel-url: ## [local] Muestra la URL publica del webhook
	@echo "Esperando la URL del tunel..."; \
	for i in $$(seq 1 20); do \
	  url=$$(docker compose logs tunnel 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1); \
	  [ -n "$$url" ] && echo "Webhook: $$url/webhook/pizzeria/pedido" && exit 0; sleep 1; \
	done; echo "No aparece todavia: prueba 'make tunnel-url' en unos segundos"

tunnel-down: ## [local] Cierra el tunel
	docker compose --profile tunnel stop tunnel tunnel-proxy

n8n-export: ## Guarda los workflows de n8n en n8n/workflows/
	@scripts/n8n-export.sh

n8n-import: ## Carga credenciales y workflows del repo en n8n
	@scripts/n8n-import.sh

agent-export: ## Guarda la config del agente de ElevenLabs en voice-agent/
	@scripts/agent-export.sh

backup: ## Copia de seguridad de las bases de datos en backups/
	@scripts/backup.sh

restore: ## Restaura una copia: make restore DIR=backups/<fecha>
	@scripts/restore.sh $(DIR)

psql: ## Consola SQL de la base de datos de pedidos
	docker compose exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
