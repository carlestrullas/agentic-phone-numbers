# Server deployment

A small VPS is enough (2 GB RAM, e.g. Hetzner CX22 or similar) running Ubuntu.

```
Internet ──HTTPS──> Caddy ─┬─ POST /webhook/pizzeria/pedido ──> n8n
                           └─ everything else ───────────────> order board (with login)
n8n editor: SSH tunnel only (not public)
```

## 1. Prepare the server

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo apt install -y make git

# Firewall: SSH and web only
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. Domain

Create a DNS **A** record for your domain (e.g. `orders.yourdomain.com`) pointing to the server IP. Caddy gets the HTTPS certificate automatically.

## 3. Code and configuration

```bash
git clone git@github.com:carlestrullas/agentic-phone-numbers.git
cd agentic-phone-numbers
make init
nano .env
```

In `.env`, change:

```env
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
DOMAIN=orders.yourdomain.com
PANEL_PASSWORD=<a password>
```

## 4. Start

```bash
make up
make n8n-import
make logs s=caddy   # check that the certificate is issued
```

## 5. Create the n8n user

From **your computer**, open an SSH tunnel and go to the editor:

```bash
ssh -L 5678:localhost:5678 user@server-ip
```

Open http://localhost:5678 and create the user. Open the same tunnel whenever you need the editor.

## 6. Connect ElevenLabs

In the agent's tool, set:

- URL: `https://orders.yourdomain.com/webhook/pizzeria/pedido`
- Header `X-Pizzeria-Token`: the `PIZZERIA_WEBHOOK_TOKEN` value from the **server's** `.env`

## 7. Check

```bash
curl -X POST https://orders.yourdomain.com/webhook/pizzeria/pedido \
  -H "Content-Type: application/json" \
  -H "X-Pizzeria-Token: <token>" \
  -d '{"nombre_cliente":"Test","telefono":"600000000","tipo_entrega":"recoger","productos":[{"producto":"Margarita"}]}'
```

It should reply `{"ok":true,...}` and the order shows up on `https://orders.yourdomain.com`.

## Automatic backups

```bash
crontab -e
# Every day at 4:00
0 4 * * * cd /home/<user>/agentic-phone-numbers && make backup >> $HOME/backup.log 2>&1
```

The last 14 are kept in `backups/`. For extra safety, also copy them off the server.

## Updating

```bash
git pull
make up            # rebuilds whatever changed
make n8n-import    # if the workflows changed
```

To upgrade n8n, change `N8N_VERSION` in `.env` and run `make backup && make up`.
