# Voice agent (ElevenLabs)

The agent **lives and is edited in ElevenLabs**. This folder keeps a copy of its configuration so it is versioned alongside the rest of the system.

```bash
make agent-export   # downloads agent.json, system-prompt.md and tools/ (needs ELEVENLABS_* in .env)
```

The webhook token is replaced with `${PIZZERIA_WEBHOOK_TOKEN}` on export, so it never reaches Git.

## "Create order" tool

| | |
|---|---|
| Method / URL | `POST https://<domain-or-tunnel>/webhook/pizzeria/pedido` |
| Header | `X-Pizzeria-Token: <PIZZERIA_WEBHOOK_TOKEN>` |

JSON body:

| Field | Type | Rule |
|---|---|---|
| `nombre_cliente` | string | required (customer name) |
| `telefono` | string | required (phone) |
| `tipo_entrega` | string | `domicilio` (delivery) or `recoger` (pickup) |
| `direccion` | string | required for delivery (address) |
| `productos` | array | `[{producto, tamano?, cantidad?, notas?}]`, at least 1 |
| `notas` | string | optional (notes) |

Response: the agent must read `mensaje`. If `ok` is `false` (400), it must ask the customer for the missing data and call the tool again.

## Switching environments

The webhook URL and token differ locally (tunnel) and on the server. When going to production, update both in the tool. Ideally keep **two agents**: a test one (pointing to the tunnel) and the real one (pointing to the server).

> If you change the order fields, change them in all three places: this tool, the "Validate order" node of the workflow and the `pedidos` table.
