# Prompt para reconstruir el flujo n8n «Pizzeria - Crear pedido (tool ElevenLabs)»

Copia todo este documento a la IA que vaya a implementarlo. Si puedes, adjunta también `n8n/workflows/pizzeria-crear-pedido-tool-elevenlabs.json`: es el flujo original y se importa directamente en n8n (menú `⋯` → *Import from File*).

---

## Encargo

Crea en n8n un flujo llamado **"Pizzeria - Crear pedido (tool ElevenLabs)"**. Es un webhook que un agente de voz de ElevenLabs usa como *tool* para registrar los pedidos telefónicos de una pizzería en una base de datos Postgres. El flujo valida los datos, inserta el pedido y responde en JSON con un mensaje que el agente de voz pueda leerle al cliente o usar para pedirle los datos que falten.

## Flujo de nodos

```
Webhook pedido → Validar pedido (Code) → ¿Es válido? (IF)
                                          ├─ true  → Insertar pedido (Postgres)
                                          │            ├─ OK    → Responder OK (200)
                                          │            └─ error → Responder error BD (500)
                                          └─ false → Responder datos incorrectos (400)
```

### 1. Webhook pedido (`n8n-nodes-base.webhook`, v2)
- Método `POST`, path `pizzeria/pedido`
- Autenticación: **Header Auth**, con una credencial llamada "Pizzeria webhook token" (un header con un token secreto que también se configura en la tool de ElevenLabs)
- Response mode: **Using 'Respond to Webhook' node**

### 2. Validar pedido (`n8n-nodes-base.code`, JavaScript)
Lee `body` del webhook. Campos de entrada:

| Campo | Tipo | Regla |
|---|---|---|
| `nombre_cliente` | string | obligatorio |
| `telefono` | string | obligatorio |
| `tipo_entrega` | string | `domicilio` o `recoger` (se pasa a minúsculas) |
| `direccion` | string | obligatoria si `tipo_entrega = domicilio` |
| `productos` | array (o string JSON) | al menos 1; cada uno `{producto, tamano?, cantidad?, notas?}`, `producto` obligatorio, `cantidad` por defecto 1 |
| `notas` | string | opcional |

Código exacto:

```js
const b = $input.first().json.body || {};
const errores = [];
const txt = v => (v === undefined || v === null) ? '' : String(v).trim();

const nombre = txt(b.nombre_cliente);
const telefono = txt(b.telefono);
const tipo = txt(b.tipo_entrega).toLowerCase();
const direccion = txt(b.direccion);
const notas = txt(b.notas);

let productos = b.productos;
if (typeof productos === 'string') {
  try { productos = JSON.parse(productos); } catch (e) { productos = null; }
}

if (!nombre) errores.push('falta nombre_cliente');
if (!telefono) errores.push('falta telefono');
if (!['domicilio', 'recoger'].includes(tipo)) errores.push("tipo_entrega debe ser 'domicilio' o 'recoger'");
if (tipo === 'domicilio' && !direccion) errores.push('falta direccion para un pedido a domicilio');
if (!Array.isArray(productos) || productos.length === 0) {
  errores.push('productos debe ser una lista con al menos un producto');
} else {
  productos = productos.map(p => ({
    producto: txt(p.producto),
    tamano: txt(p.tamano) || null,
    cantidad: parseInt(p.cantidad, 10) || 1,
    notas: txt(p.notas) || null,
  }));
  if (productos.some(p => !p.producto)) errores.push('cada producto necesita un nombre en el campo producto');
}

if (errores.length) return [{ json: { valido: false, errores } }];

return [{ json: {
  valido: true,
  nombre_cliente: nombre,
  telefono,
  tipo_entrega: tipo,
  direccion: direccion || null,
  productos: JSON.stringify(productos),
  notas: notas || null,
} }];
```

### 3. ¿Es válido? (`n8n-nodes-base.if`, v2.2)
Condición booleana: `{{ $json.valido }}` es `true`.

### 4. Insertar pedido (`n8n-nodes-base.postgres`, v2.5)
- Operación: *Execute Query*
- **On Error: Continue (using error output)**, para que un fallo de la BD vaya a la rama de error
- Credencial Postgres: "Postgres pizzeria"
- Query:
```sql
INSERT INTO pedidos (nombre_cliente, telefono, tipo_entrega, direccion, productos, notas)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
RETURNING id, estado, creado_en;
```
- Query Parameters (option *queryReplacement*):
`{{ [$json.nombre_cliente, $json.telefono, $json.tipo_entrega, $json.direccion, $json.productos, $json.notas] }}`

### 5. Respuestas (`n8n-nodes-base.respondToWebhook`, v1.1, Respond With: JSON)
- **Responder OK** (200):
  `{{ { ok: true, pedido_id: $json.id, estado: $json.estado, mensaje: 'Pedido registrado con el numero ' + $json.id } }}`
- **Responder error BD** (500):
  `{{ { ok: false, mensaje: 'No se ha podido guardar el pedido. Pide disculpas al cliente y que vuelva a intentarlo.' } }}`
- **Responder datos incorrectos** (400):
  `{{ { ok: false, errores: $json.errores, mensaje: 'Faltan datos o son incorrectos: ' + $json.errores.join('; ') + '. Pideselos al cliente y vuelve a llamar a la herramienta.' } }}`

## Tabla `pedidos` (Postgres)

La definición completa está en `services/postgres/init/01-pedidos.sql`.

## Credenciales
Los secretos no van en la exportación. En este repo las crea `make n8n-import` a partir del `.env` (`n8n/scripts/credentials.js`):
1. **Header Auth** "Pizzeria webhook token": nombre del header y token (el mismo que use la tool de ElevenLabs).
2. **Postgres** "Postgres pizzeria": host, puerto, base de datos `pizzeria`, usuario y contraseña.

## Configuración de la tool en ElevenLabs
- URL: `https://<tu-dominio-o-tunel>/webhook/pizzeria/pedido`, método POST, con el header de autenticación.
- Parámetros del body: los de la tabla de campos de arriba. Describe `productos` como una lista de objetos `{producto, tamano, cantidad, notas}`.
- El agente debe leer el `mensaje` de la respuesta: si `ok` es `false` con código 400, pedir al cliente los datos que falten y volver a llamar a la tool.
