# Rebuilding the n8n workflow "Pizzeria - Create order (ElevenLabs tool)"

Prompt for another AI (or a person) to rebuild the workflow from scratch. Normally you don't need it: `make n8n-import` loads `n8n/workflows/pizzeria-create-order.json` directly.

---

## Task

Create an n8n workflow called **"Pizzeria - Create order (ElevenLabs tool)"**. It is a webhook that an ElevenLabs voice agent uses as a *tool* to record a pizzeria's phone orders in a Postgres database. The workflow validates the data, inserts the order and replies with JSON containing a message the voice agent can read to the customer, or use to ask for missing data.

Field names, values and response messages are in Spanish: the agent talks to customers in Spanish.

## Node flow

```
Order webhook → Validate order (Code) → Is valid? (IF)
                                          ├─ true  → Insert order (Postgres)
                                          │            ├─ OK    → Respond OK (200)
                                          │            └─ error → Respond DB error (500)
                                          └─ false → Respond invalid data (400)
```

### 1. Order webhook (`n8n-nodes-base.webhook`, v2)
- Method `POST`, path `pizzeria/pedido`
- Authentication: **Header Auth**, credential "Pizzeria webhook token" (header `X-Pizzeria-Token`, same token as the ElevenLabs tool)
- Response mode: **Using 'Respond to Webhook' node**

### 2. Validate order (`n8n-nodes-base.code`, JavaScript)
Reads `body` from the webhook. Input fields:

| Field | Type | Rule |
|---|---|---|
| `nombre_cliente` | string | required |
| `telefono` | string | required |
| `tipo_entrega` | string | `domicilio` or `recoger` (lower-cased) |
| `direccion` | string | required when `tipo_entrega = domicilio` |
| `productos` | array (or JSON string) | at least 1; each `{producto, tamano?, cantidad?, notas?}`, `producto` required, `cantidad` defaults to 1 |
| `notas` | string | optional |

Exact code:

```js
// Input: the JSON body sent by the ElevenLabs tool.
// Output field names (errores) and messages stay in Spanish: they are part of the
// contract with the voice agent, which talks to customers in Spanish.
const body = $input.first().json.body || {};
const errors = [];
const text = v => (v === undefined || v === null) ? '' : String(v).trim();

const name = text(body.nombre_cliente);
const phone = text(body.telefono);
const deliveryType = text(body.tipo_entrega).toLowerCase();
const address = text(body.direccion);
const notes = text(body.notas);

let items = body.productos;
if (typeof items === 'string') {
  try { items = JSON.parse(items); } catch (e) { items = null; }
}

if (!name) errors.push('falta nombre_cliente');
if (!phone) errors.push('falta telefono');
if (!['domicilio', 'recoger'].includes(deliveryType)) errors.push("tipo_entrega debe ser 'domicilio' o 'recoger'");
if (deliveryType === 'domicilio' && !address) errors.push('falta direccion para un pedido a domicilio');
if (!Array.isArray(items) || items.length === 0) {
  errors.push('productos debe ser una lista con al menos un producto');
} else {
  items = items.map(it => ({
    producto: text(it.producto),
    tamano: text(it.tamano) || null,
    cantidad: parseInt(it.cantidad, 10) || 1,
    notas: text(it.notas) || null,
  }));
  if (items.some(it => !it.producto)) errors.push('cada producto necesita un nombre en el campo producto');
}

if (errors.length) return [{ json: { valid: false, errores: errors } }];

return [{ json: {
  valid: true,
  nombre_cliente: name,
  telefono: phone,
  tipo_entrega: deliveryType,
  direccion: address || null,
  productos: JSON.stringify(items),
  notas: notes || null,
} }];
```

### 3. Is valid? (`n8n-nodes-base.if`, v2.2)
Boolean condition: `{{ $json.valid }}` is `true`.

### 4. Insert order (`n8n-nodes-base.postgres`, v2.5)
- Operation: *Execute Query*
- **On Error: Continue (using error output)**, so a DB failure goes to the error branch
- Postgres credential: "Postgres pizzeria"
- Query:
```sql
INSERT INTO pedidos (nombre_cliente, telefono, tipo_entrega, direccion, productos, notas)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
RETURNING id, estado, creado_en;
```
- Query Parameters (option *queryReplacement*): `{{ [$json.nombre_cliente, $json.telefono, $json.tipo_entrega, $json.direccion, $json.productos, $json.notas] }}`

### 5. Responses (`n8n-nodes-base.respondToWebhook`, v1.1, Respond With: JSON)
- **Respond OK** (200): `{{ { ok: true, pedido_id: $json.id, estado: $json.estado, mensaje: 'Pedido registrado con el numero ' + $json.id } }}`
- **Respond DB error** (500): `{{ { ok: false, mensaje: 'No se ha podido guardar el pedido. Pide disculpas al cliente y que vuelva a intentarlo.' } }}`
- **Respond invalid data** (400): `{{ { ok: false, errores: $json.errores, mensaje: 'Faltan datos o son incorrectos: ' + $json.errores.join('; ') + '. Pideselos al cliente y vuelve a llamar a la herramienta.' } }}`

## `pedidos` table (Postgres)

Full definition in `services/postgres/init/01-pedidos.sql`.

## Credentials

Secrets are not part of the export. In this repo `make n8n-import` creates them from `.env` (`n8n/scripts/credentials.js`):
1. **Header Auth** "Pizzeria webhook token": header name `X-Pizzeria-Token` and the token (same as the ElevenLabs tool).
2. **Postgres** "Postgres pizzeria": host `postgres`, port 5432, database `pizzeria`, user and password.

## ElevenLabs tool setup

See [`voice-agent/README.md`](../voice-agent/README.md).
