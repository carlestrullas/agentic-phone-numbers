// Kitchen order board.
// Serves the static frontend, exposes a small API over the `pedidos` table and forwards
// Postgres notifications (LISTEN/NOTIFY) to the browser as Server-Sent Events.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool, Client } = require("pg");

const PORT = process.env.PORT || 8080;
const db = {
  host: process.env.PGHOST || "postgres",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
};

// Basic auth (user + password). If PANEL_PASSWORD is empty no login is required
// (handy locally). With REQUIRE_AUTH=true (server) a password is mandatory.
const PANEL_USER = process.env.PANEL_USER || "kitchen";
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";
if (process.env.REQUIRE_AUTH === "true" && !PANEL_PASSWORD) {
  console.error("PANEL_PASSWORD is missing: the board must be password-protected on the server");
  process.exit(1);
}

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

function auth(req, res, next) {
  if (!PANEL_PASSWORD) return next();
  const [scheme, value] = (req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && value) {
    const text = Buffer.from(value, "base64").toString();
    const i = text.indexOf(":");
    if (i >= 0 && safeEqual(text.slice(0, i), PANEL_USER) && safeEqual(text.slice(i + 1), PANEL_PASSWORD)) {
      return next();
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Orders", charset="UTF-8"');
  res.status(401).send("Unauthorized");
}

const pool = new Pool({ ...db, max: 5 });
const app = express();
app.disable("x-powered-by");
app.get("/healthz", (req, res) => res.send("ok"));
app.use(auth);
app.use(express.static(path.join(__dirname, "public")));

const COLUMNS = `id, nombre_cliente, telefono, tipo_entrega, direccion, productos, notas,
                 estado, creado_en, finalizado_en`;

// All pending orders + those completed in the last 12 hours
app.get("/api/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM pedidos
       WHERE estado <> 'finalizado' OR finalizado_en >= now() - interval '12 hours'
       ORDER BY creado_en`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/orders", err.message);
    res.status(500).json({ error: "No se han podido leer los pedidos" });
  }
});

async function setStatus(req, res, status) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id no valido" });
  try {
    const { rows } = await pool.query(
      `UPDATE pedidos
       SET estado = $2, finalizado_en = CASE WHEN $2 = 'finalizado' THEN now() ELSE NULL END
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, status]
    );
    if (!rows.length) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(`POST status ${status}`, err.message);
    res.status(500).json({ error: "No se ha podido actualizar el pedido" });
  }
}

app.post("/api/orders/:id/complete", (req, res) => setStatus(req, res, "finalizado"));
app.post("/api/orders/:id/reopen", (req, res) => setStatus(req, res, "pendiente"));

// --- Real time: Postgres NOTIFY -> SSE ---
const clients = new Set();

app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

// Keeps SSE connections alive through proxies
setInterval(() => {
  for (const res of clients) res.write(": ping\n\n");
}, 25000);

async function listenToPostgres() {
  const listener = new Client(db);
  let closed = false;
  const retry = (err) => {
    if (closed) return;
    closed = true;
    if (err) console.error("LISTEN disconnected:", err.message);
    listener.removeAllListeners();
    listener.end().catch(() => {});
    setTimeout(listenToPostgres, 3000);
  };
  try {
    await listener.connect();
    listener.on("notification", (n) => {
      let data = {};
      try { data = JSON.parse(n.payload); } catch { /* non-JSON payload */ }
      broadcast("change", data);
    });
    listener.on("error", retry);
    listener.on("end", () => retry());
    await listener.query("LISTEN pedidos_cambio");
    console.log("Listening for changes on the pedidos table");
    broadcast("change", { op: "RECONNECT" });
  } catch (err) {
    retry(err);
  }
}

listenToPostgres();
app.listen(PORT, () => console.log(`Order board listening on container port ${PORT}`));
