# Despliegue en un servidor

Para este sistema basta un VPS pequeño (2 GB de RAM, por ejemplo Hetzner CX22 o similar) con Ubuntu.

```
Internet ──HTTPS──> Caddy ─┬─ POST /webhook/pizzeria/pedido ──> n8n
                           └─ todo lo demás ──────────────────> panel de comandas (con login)
Editor de n8n: solo por túnel SSH (no es público)
```

## 1. Preparar el servidor

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo apt install -y make git

# Firewall: solo SSH y web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. Dominio

Crea un registro DNS **A** de tu dominio (por ejemplo `pedidos.tudominio.com`) apuntando a la IP del servidor. Caddy sacará el certificado HTTPS solo.

## 3. Código y configuración

```bash
git clone git@github.com:<usuario>/agentic-phone-orders.git
cd agentic-phone-orders
make init
nano .env
```

En el `.env` cambia:

```env
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
DOMAIN=pedidos.tudominio.com
PANEL_PASSWORD=<una contraseña>
```

## 4. Arrancar

```bash
make up
make n8n-import
make logs s=caddy   # comprueba que obtiene el certificado
```

## 5. Crear el usuario de n8n

Desde **tu ordenador**, abre un túnel SSH y entra al editor:

```bash
ssh -L 5678:localhost:5678 usuario@IP-del-servidor
```

Abre http://localhost:5678 y crea el usuario. Siempre que quieras entrar al editor, abre el mismo túnel.

## 6. Conectar ElevenLabs

En la tool del agente pon:

- URL: `https://pedidos.tudominio.com/webhook/pizzeria/pedido`
- Cabecera `X-Pizzeria-Token`: el valor de `PIZZERIA_WEBHOOK_TOKEN` del `.env` **del servidor**

## 7. Comprobar

```bash
curl -X POST https://pedidos.tudominio.com/webhook/pizzeria/pedido \
  -H "Content-Type: application/json" \
  -H "X-Pizzeria-Token: <token>" \
  -d '{"nombre_cliente":"Prueba","telefono":"600000000","tipo_entrega":"recoger","productos":[{"producto":"Margarita"}]}'
```

Debe responder `{"ok":true,...}` y el pedido aparece en `https://pedidos.tudominio.com`.

## Copias de seguridad automáticas

```bash
crontab -e
# Cada día a las 4:00
0 4 * * * cd /home/<usuario>/agentic-phone-orders && make backup >> $HOME/backup.log 2>&1
```

Se guardan las últimas 14 en `backups/`. Para mayor seguridad, cópialas también fuera del servidor.

## Actualizar

```bash
git pull
make up            # reconstruye lo que haya cambiado
make n8n-import    # si han cambiado los workflows
```

Para actualizar n8n, cambia `N8N_VERSION` en el `.env` y ejecuta `make backup && make up`.
