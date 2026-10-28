# Agente de voz (ElevenLabs)

El agente **vive y se edita en ElevenLabs**. Esta carpeta guarda una copia de su configuración para tenerla versionada junto al resto del sistema.

```bash
make agent-export   # descarga agent.json, system-prompt.md y tools/ (necesita ELEVENLABS_* en el .env)
```

El token del webhook se sustituye por `${PIZZERIA_WEBHOOK_TOKEN}` al exportar, para que no llegue a Git.

## Tool «crear pedido»

| | |
|---|---|
| Método / URL | `POST https://<dominio-o-túnel>/webhook/pizzeria/pedido` |
| Cabecera | `X-Pizzeria-Token: <PIZZERIA_WEBHOOK_TOKEN>` |

Body (JSON):

| Campo | Tipo | Regla |
|---|---|---|
| `nombre_cliente` | string | obligatorio |
| `telefono` | string | obligatorio |
| `tipo_entrega` | string | `domicilio` o `recoger` |
| `direccion` | string | obligatoria si es a domicilio |
| `productos` | array | `[{producto, tamano?, cantidad?, notas?}]`, mínimo 1 |
| `notas` | string | opcional |

Respuesta: el agente debe leer `mensaje`. Si `ok` es `false` (400), tiene que pedir al cliente los datos que falten y volver a llamar a la tool.

## Al cambiar de entorno

La URL del webhook y el token son distintos en local (túnel) y en el servidor. Al pasar a producción, actualiza ambos en la tool. Lo ideal es tener **dos agentes**: uno de pruebas (apuntando al túnel) y el real (apuntando al servidor).

> Si cambias los campos del pedido, cámbialos en los tres sitios: esta tool, el nodo «Validar pedido» del workflow y la tabla `pedidos`.
