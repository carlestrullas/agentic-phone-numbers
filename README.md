# Agentic Phone Orders

AI phone ordering for a pizzeria. A voice agent answers the call, takes the order and saves it; the kitchen sees it instantly on a live order board.

```
Customer ──call──> Voice agent (ElevenLabs)
                        │ tool: POST /webhook/pizzeria/pedido
                        ▼
                   n8n (validates and inserts) ──> Postgres (pedidos table)
                                                        │ real time
                                                        ▼
                                              Order board (kitchen)
```

| Service | What it does | Local |
|---|---|---|
| `postgres` | `pizzeria` DB (orders) and `n8n` DB (n8n internal data) | `localhost:5432` |
| `n8n` | Workflows: receives the order, validates it and saves it | http://localhost:5678 |
| `frontend` | Real-time order board | http://localhost:8081 |
| `caddy` | *(server only)* HTTPS and reverse proxy | — |

## Structure

```
├── docker-compose.yml          # shared services
├── docker-compose.local.yml    # local: ports on localhost + optional tunnel
├── docker-compose.prod.yml     # server: Caddy with HTTPS
├── Makefile                    # every command (make help)
├── .env.example                # configuration (copy to .env)
├── services/                   # postgres, frontend, proxy (Caddy), tunnel (nginx)
├── n8n/workflows/              # versioned n8n workflows  ← source of truth
├── n8n/scripts/                # export/import and credentials
├── voice-agent/                # copy of the ElevenLabs agent config
└── docs/                       # server deployment and workflow details
```

## Run locally

Requirements: Docker Desktop and `make`.

```bash
make init        # create .env with random secrets
make up          # start postgres, n8n and the order board
make n8n-import  # load workflows and credentials into n8n
```

1. Open http://localhost:5678 and create your n8n user (first time only).
2. Open the order board at http://localhost:8081.

## n8n workflows: how they are versioned

Workflows **live in Git** (`n8n/workflows/`). The n8n database is just a copy loaded from there.

```bash
# 1. Edit the workflow in the n8n editor
make n8n-export                                 # 2. save it to n8n/workflows/
git add n8n/workflows && git commit -m "..."    # 3. commit
# 4. On another machine / the server:
git pull && make n8n-import
```

- **Credentials** are not versioned. `make n8n-import` creates them from `.env` (see `n8n/scripts/credentials.js`).
- **Executions and history** stay in each environment's database.
- If you forget `make n8n-export`, your changes only exist in that n8n instance.

## Test with ElevenLabs from your machine

```bash
make tunnel        # opens a Cloudflare tunnel and prints the webhook URL
make tunnel-down   # closes it
```

Only `POST /webhook/pizzeria/pedido` is exposed. The URL **changes every time**: update it in the ElevenLabs tool. Details in [`voice-agent/`](voice-agent/README.md).

## Deploy to a server

In short: a VPS with Docker + a domain pointing to it + `.env` with the production `COMPOSE_FILE` + `make up` + `make n8n-import`.

Step by step in **[docs/deploy.md](docs/deploy.md)**.

## Commands

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop everything (data is kept) |
| `make ps` · `make logs s=n8n` | Status · logs (all services or one) |
| `make n8n-export` | n8n workflows → `n8n/workflows/` |
| `make n8n-import` | `n8n/workflows/` + credentials from `.env` → n8n |
| `make agent-export` | ElevenLabs agent config → `voice-agent/` |
| `make tunnel` · `make tunnel-down` | Temporary public tunnel (local only) |
| `make backup` · `make restore DIR=…` | Back up / restore the databases |
| `make psql` | SQL console on the orders database |

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `COMPOSE_FILE` | Environment: `…local.yml` or `…prod.yml` |
| `POSTGRES_*` | Orders database user, password and name |
| `N8N_ENCRYPTION_KEY` | Encrypts n8n credentials. **Do not change it** once started |
| `PIZZERIA_WEBHOOK_TOKEN` | Token ElevenLabs sends in the `X-Pizzeria-Token` header |
| `PANEL_USER` / `PANEL_PASSWORD` | Order board login (required on the server) |
| `DOMAIN` | Server domain |
| `ELEVENLABS_*` | Optional, for `make agent-export` |

## Database

The schema lives in `services/postgres/init/` and **is only applied when the database is first created**. For later changes, add a new `.sql` file there (for new installs) and apply it manually to existing ones with `make psql`.

## Language

Code and docs are in English. Two things stay in Spanish on purpose: the order board UI (used by the pizzeria staff) and the data contract shared by the voice agent, the workflow and the database (`pedidos` table, fields such as `nombre_cliente`, the webhook path and the messages returned to the agent).
