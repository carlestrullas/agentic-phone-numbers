# Panel de comandas

Muestra en tiempo real los pedidos de la tabla `pedidos` y permite marcarlos como finalizados.

- **Tiempo real:** un trigger de Postgres (`NOTIFY pedidos_cambio`) avisa de cada cambio y el servidor lo reenvía al navegador por Server-Sent Events. Además recarga cada 60 s como red de seguridad.
- **Login:** usuario y contraseña de `PANEL_USER` / `PANEL_PASSWORD`. Si la contraseña está vacía no pide login (solo en local).
- **Uso:** pendientes del más antiguo al más nuevo (amarillo a partir de 15 min, rojo a partir de 30). *Finalizados* muestra las últimas 12 h, con *Deshacer*. El sonido se activa con el botón de la cabecera.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/pedidos` | Pendientes + finalizados de las últimas 12 h |
| POST | `/api/pedidos/:id/finalizar` | Marca un pedido como finalizado |
| POST | `/api/pedidos/:id/reabrir` | Lo devuelve a pendiente |
| GET | `/api/stream` | Eventos en tiempo real (SSE) |
| GET | `/healthz` | Comprobación de salud (sin login) |

Tras cambiar el código: `make up` (reconstruye la imagen).
