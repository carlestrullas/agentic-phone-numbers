# agentic-phone-orders

Sistema de pedidos telefónicos con IA para una pizzería. Un agente de voz atiende la llamada, toma el pedido y lo registra; la cocina lo ve al momento en un panel web.

```
Cliente ──llamada──> Agente de voz (ElevenLabs)
                          │ tool: POST /webhook/pizzeria/pedido
                          ▼
                     n8n (valida e inserta) ──> Postgres (tabla pedidos)
                                                     │ tiempo real
                                                     ▼
                                          Panel de comandas (cocina)
```

| Servicio | Qué hace | Local |
|---|---|---|
| `postgres` | BD `pizzeria` (pedidos) y BD `n8n` (datos internos de n8n) | `localhost:5432` |
| `n8n` | Workflows: recibe el pedido, lo valida y lo guarda | http://localhost:5678 |
| `frontend` | Panel de comandas en tiempo real | http://localhost:8081 |
| `caddy` | *(solo servidor)* HTTPS y proxy | — |

## Estructura

```
├── docker-compose.yml          # servicios comunes
├── docker-compose.local.yml    # local: puertos en localhost + túnel opcional
├── docker-compose.prod.yml     # servidor: Caddy con HTTPS
├── Makefile                    # todos los comandos (make help)
├── .env.example                # configuración (copiar a .env)
├── services/                   # postgres, frontend, proxy (Caddy), tunnel (nginx)
├── n8n/workflows/              # workflows de n8n versionados  ← fuente de verdad
├── n8n/scripts/                # export/import y credenciales
├── voice-agent/                # copia de la config del agente de ElevenLabs
└── docs/                       # despliegue en servidor y detalle del workflow
```

## Arrancar en local

Requisitos: Docker Desktop y `make`.

```bash
make init        # crea el .env con contraseñas aleatorias
make up          # arranca postgres, n8n y el panel
make n8n-import  # carga workflows y credenciales en n8n
```

1. Abre http://localhost:5678 y crea tu usuario de n8n (solo la primera vez).
2. Abre el panel en http://localhost:8081.

## Workflows de n8n: cómo se versionan

Los workflows **viven en Git** (`n8n/workflows/`). La base de datos de n8n es solo una copia que se carga desde ahí.

```bash
# 1. Editas el workflow en el editor de n8n
make n8n-export                    # 2. lo guardas en n8n/workflows/
git add n8n/workflows && git commit -m "..."   # 3. commit
# 4. En otra máquina / el servidor:
git pull && make n8n-import
```

- **Credenciales:** no se versionan. `make n8n-import` las crea a partir del `.env` (ver `n8n/scripts/credentials.js`).
- **Ejecuciones e historial:** se quedan en la BD de cada entorno.
- Si olvidas `make n8n-export`, los cambios solo existen en ese n8n.

## Probar con ElevenLabs desde local

```bash
make tunnel        # abre un túnel de Cloudflare y muestra la URL del webhook
make tunnel-down   # lo cierra
```

Solo se expone `POST /webhook/pizzeria/pedido`. La URL **cambia cada vez**: actualízala en la tool de ElevenLabs. Detalles en [`voice-agent/`](voice-agent/README.md).

## Desplegar en el servidor

Resumen: VPS con Docker + dominio apuntando a él + `.env` con `COMPOSE_FILE` de producción + `make up` + `make n8n-import`.

Paso a paso en **[docs/deploy.md](docs/deploy.md)**.

## Comandos

| Comando | Qué hace |
|---|---|
| `make up` / `make down` | Arranca / para todo (los datos se mantienen) |
| `make ps` · `make logs s=n8n` | Estado · logs (de todo o de un servicio) |
| `make n8n-export` | Workflows de n8n → `n8n/workflows/` |
| `make n8n-import` | `n8n/workflows/` + credenciales del `.env` → n8n |
| `make agent-export` | Config del agente de ElevenLabs → `voice-agent/` |
| `make tunnel` · `make tunnel-down` | Túnel público temporal (solo local) |
| `make backup` · `make restore DIR=…` | Copia / restauración de las bases de datos |
| `make psql` | Consola SQL de la BD de pedidos |

## Configuración (`.env`)

| Variable | Para qué |
|---|---|
| `COMPOSE_FILE` | Entorno: `…local.yml` o `…prod.yml` |
| `POSTGRES_*` | Usuario, contraseña y BD de pedidos |
| `N8N_ENCRYPTION_KEY` | Cifra las credenciales de n8n. **No cambiarla** una vez arrancado |
| `PIZZERIA_WEBHOOK_TOKEN` | Token que ElevenLabs envía en la cabecera `X-Pizzeria-Token` |
| `PANEL_USER` / `PANEL_PASSWORD` | Login del panel (obligatorio en el servidor) |
| `DOMAIN` | Dominio del servidor |
| `ELEVENLABS_*` | Opcional, para `make agent-export` |

## Base de datos

El esquema está en `services/postgres/init/` y **solo se aplica al crear la BD por primera vez**. Para cambios posteriores, añade un nuevo `.sql` en esa carpeta (para instalaciones nuevas) y aplícalo a mano en las existentes con `make psql`.
