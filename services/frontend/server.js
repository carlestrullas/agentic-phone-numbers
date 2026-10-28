// Panel de comandas de la pizzeria.
// Sirve el frontend estatico, expone una API minima sobre la tabla `pedidos`
// y reenvia al navegador (Server-Sent Events) los avisos de Postgres (LISTEN/NOTIFY).
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

// Login basico (usuario + contrasena). Si PANEL_PASSWORD esta vacio no se pide login
// (util en local). Con REQUIRE_AUTH=true (servidor) es obligatorio tener contrasena.
const PANEL_USER = process.env.PANEL_USER || "cocina";
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";
if (process.env.REQUIRE_AUTH === "true" && !PANEL_PASSWORD) {
  console.error("Falta PANEL_PASSWORD: en el servidor el panel tiene que llevar contrasena");
  process.exit(1);
}

const iguales = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

function login(req, res, next) {
  if (!PANEL_PASSWORD) return next();
  const [tipo, valor] = (req.headers.authorization || "").split(" ");
  if (tipo === "Basic" && valor) {
    const texto = Buffer.from(valor, "base64").toString();
    const i = texto.indexOf(":");
    if (i >= 0 && iguales(texto.slice(0, i), PANEL_USER) && iguales(texto.slice(i + 1), PANEL_PASSWORD)) {
      return next();
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Comandas", charset="UTF-8"');
  res.status(401).send("Acceso restringido");
}

const pool = new Pool({ ...db, max: 5 });
const app = express();
app.disable("x-powered-by");
app.get("/healthz", (req, res) => res.send("ok"));
app.use(login);
app.use(express.static(path.join(__dirname, "public")));

const COLUMNAS = `id, nombre_cliente, telefono, tipo_entrega, direccion, productos, notas,
                  estado, creado_en, finalizado_en`;

// Todos los pendientes + los finalizados de las ultimas 12 horas
app.get("/api/pedidos", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS} FROM pedidos
       WHERE estado <> 'finalizado' OR finalizado_en >= now() - interval '12 hours'
       ORDER BY creado_en`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/pedidos", err.message);
    res.status(500).json({ error: "No se han podido leer los pedidos" });
  }
});

async function cambiarEstado(req, res, estado) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id no valido" });
  try {
    const { rows } = await pool.query(
      `UPDATE pedidos
       SET estado = $2, finalizado_en = CASE WHEN $2 = 'finalizado' THEN now() ELSE NULL END
       WHERE id = $1
       RETURNING ${COLUMNAS}`,
      [id, estado]
    );
    if (!rows.length) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(`POST estado ${estado}`, err.message);
    res.status(500).json({ error: "No se ha podido actualizar el pedido" });
  }
}

app.post("/api/pedidos/:id/finalizar", (req, res) => cambiarEstado(req, res, "finalizado"));
app.post("/api/pedidos/:id/reabrir", (req, res) => cambiarEstado(req, res, "pendiente"));

// --- Tiempo real: Postgres NOTIFY -> SSE ---
const clientes = new Set();

app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  clientes.add(res);
  req.on("close", () => clientes.delete(res));
});

function emitir(evento, datos) {
  const msg = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of clientes) res.write(msg);
}

// Mantiene viva la conexion SSE a traves de proxies
setInterval(() => {
  for (const res of clientes) res.write(": ping\n\n");
}, 25000);

async function escucharPostgres() {
  const listener = new Client(db);
  let cerrado = false;
  const reintentar = (err) => {
    if (cerrado) return;
    cerrado = true;
    if (err) console.error("LISTEN desconectado:", err.message);
    listener.removeAllListeners();
    listener.end().catch(() => {});
    setTimeout(escucharPostgres, 3000);
  };
  try {
    await listener.connect();
    listener.on("notification", (n) => {
      let datos = {};
      try { datos = JSON.parse(n.payload); } catch { /* payload no JSON */ }
      emitir("cambio", datos);
    });
    listener.on("error", reintentar);
    listener.on("end", () => reintentar());
    await listener.query("LISTEN pedidos_cambio");
    console.log("Escuchando cambios en la tabla pedidos");
    emitir("cambio", { op: "RECONNECT" });
  } catch (err) {
    reintentar(err);
  }
}

escucharPostgres();
app.listen(PORT, () => console.log(`Panel de comandas escuchando en el puerto ${PORT} del contenedor`));
