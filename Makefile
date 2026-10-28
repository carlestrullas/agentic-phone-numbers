# Project commands. Run `make help` for the list.
# They use `docker compose`, which reads from .env which compose files to load (local or server).

.DEFAULT_GOAL := help
.PHONY: help init up down restart ps logs tunnel tunnel-url tunnel-down \
        n8n-export n8n-import agent-export backup restore psql

help: ## Show this help
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-13s %s\n", $$1, $$2}'

init: ## Create .env with random secrets
	@scripts/init-env.sh

up: ## Start all services
	docker compose up -d --build

down: ## Stop all services (data is kept)
	docker compose --profile tunnel down

restart: ## Restart all services
	docker compose restart

ps: ## Service status
	docker compose ps

logs: ## Follow logs (make logs s=n8n for a single service)
	docker compose logs -f $(s)

tunnel: ## [local] Expose the webhook through a Cloudflare tunnel
	docker compose --profile tunnel up -d
	@$(MAKE) --no-print-directory tunnel-url

tunnel-url: ## [local] Print the public webhook URL
	@echo "Waiting for the tunnel URL..."; \
	for i in $$(seq 1 20); do \
	  url=$$(docker compose logs tunnel 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1); \
	  [ -n "$$url" ] && echo "Webhook: $$url/webhook/pizzeria/pedido" && exit 0; sleep 1; \
	done; echo "Not available yet: try 'make tunnel-url' again in a few seconds"

tunnel-down: ## [local] Close the tunnel
	docker compose --profile tunnel stop tunnel tunnel-proxy

n8n-export: ## Save the n8n workflows into n8n/workflows/
	@scripts/n8n-export.sh

n8n-import: ## Load credentials and workflows from the repo into n8n
	@scripts/n8n-import.sh

agent-export: ## Save the ElevenLabs agent config into voice-agent/
	@scripts/agent-export.sh

backup: ## Back up the databases into backups/
	@scripts/backup.sh

restore: ## Restore a backup: make restore DIR=backups/<date>
	@scripts/restore.sh $(DIR)

psql: ## SQL console on the orders database
	docker compose exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
