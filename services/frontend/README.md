# Order board

Shows the orders in the `pedidos` table in real time and lets the kitchen mark them as completed. The UI is in Spanish, for the pizzeria staff.

- **Real time:** a Postgres trigger (`NOTIFY pedidos_cambio`) reports every change and the server forwards it to the browser via Server-Sent Events. It also reloads every 60 s as a safety net.
- **Login:** user and password from `PANEL_USER` / `PANEL_PASSWORD`. With an empty password no login is required (local only).
- **Usage:** pending orders from oldest to newest (yellow after 15 min, red after 30). The *Finalizados* column shows the last 12 h, with *Deshacer* (undo). Sound alerts are toggled from the header button.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/orders` | Pending + completed in the last 12 h |
| POST | `/api/orders/:id/complete` | Marks an order as completed |
| POST | `/api/orders/:id/reopen` | Moves it back to pending |
| GET | `/api/stream` | Real-time events (SSE) |
| GET | `/healthz` | Health check (no login) |

After changing the code: `make up` (rebuilds the image).
