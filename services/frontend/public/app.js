"use strict";

const $ = (id) => document.getElementById(id);
const UMBRAL_MEDIA = 15;   // minutos de espera para marcar en amarillo
const UMBRAL_ALTA = 30;    // minutos de espera para marcar en rojo

let pedidos = [];
let idsConocidos = null;   // null hasta la primera carga, para no avisar de lo que ya habia
const idsNuevos = new Set();
let sonidoActivo = false;

// ---------- utilidades ----------
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

function svg(markup, cls) {
  const t = document.createElement("template");
  t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ""}>${markup}</svg>`;
  return t.content.firstChild;
}

const ICONOS = {
  moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h7l-3-7H9M15 6h3l2.5 8M5.5 14l2-4h3"/>',
  bolsa: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  nota: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
};

const fmtHora = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

function minutosDesde(fecha) {
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
}

function textoEspera(min) {
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  return `${horas} h ${String(min % 60).padStart(2, "0")} min`;
}

function urgencia(min) {
  if (min >= UMBRAL_ALTA) return "alta";
  if (min >= UMBRAL_MEDIA) return "media";
  return "baja";
}

function listaProductos(p) {
  let productos = p.productos;
  if (typeof productos === "string") {
    try { productos = JSON.parse(productos); } catch { productos = []; }
  }
  return Array.isArray(productos) ? productos : [];
}

// ---------- render ----------
function renderTicket(p) {
  const min = minutosDesde(p.creado_en);
  const domicilio = p.tipo_entrega === "domicilio";
  const telLimpio = String(p.telefono || "").replace(/[^\d+]/g, "");

  const productos = listaProductos(p).map((prod) =>
    h("li", {},
      h("span", { class: "cant" }, `${prod.cantidad || 1}×`),
      h("span", { class: "prod" }, prod.producto || "Producto", prod.tamano ? h("span", { class: "tam" }, prod.tamano) : null),
      prod.notas ? h("span", { class: "prod-nota" }, prod.notas) : null
    )
  );

  const boton = h("button", { class: "btn-finalizar", type: "button", onclick: () => finalizar(p.id, ticket, boton) },
    svg(ICONOS.check), "Marcar como finalizado");

  const ticket = h("article", {
      class: "ticket" + (idsNuevos.has(p.id) ? " nuevo" : ""),
      dataset: { id: p.id, tipo: p.tipo_entrega, urgencia: urgencia(min) },
      "aria-label": `Pedido ${p.id} de ${p.nombre_cliente}`,
    },
    h("div", { class: "ticket-top" },
      h("div", { class: "numero" }, h("small", {}, "#"), p.id),
      h("div", { class: "tiempos" },
        h("time", { class: "hora", datetime: p.creado_en }, fmtHora.format(new Date(p.creado_en))),
        h("span", { class: "espera", dataset: { creado: p.creado_en } }, textoEspera(min))
      )
    ),
    h("span", { class: `badge ${domicilio ? "domicilio" : "recoger"}` },
      svg(domicilio ? ICONOS.moto : ICONOS.bolsa), domicilio ? "A domicilio" : "Para recoger"),
    h("div", { class: "cliente" }, p.nombre_cliente),
    h("div", { class: "contacto" },
      telLimpio ? h("a", { href: `tel:${telLimpio}` }, p.telefono) : null,
      domicilio && p.direccion ? h("span", {}, p.direccion) : null
    ),
    productos.length ? h("ul", { class: "productos" }, productos) : null,
    p.notas ? h("p", { class: "nota-general" }, svg(ICONOS.nota), p.notas) : null,
    boton
  );
  return ticket;
}

function renderHecho(p) {
  const btn = h("button", { class: "btn-deshacer", type: "button", onclick: () => reabrir(p.id, btn) }, "Deshacer");
  return h("li", {},
    h("span", { class: "check" }, svg(ICONOS.check)),
    h("div", { class: "hecho-info" },
      h("strong", {}, `#${p.id} · ${p.nombre_cliente}`),
      h("span", {}, `Finalizado a las ${fmtHora.format(new Date(p.finalizado_en || p.creado_en))} · ` +
                    (p.tipo_entrega === "domicilio" ? "domicilio" : "recoger"))
    ),
    btn
  );
}

function render() {
  const pendientes = pedidos.filter((p) => p.estado !== "finalizado");
  const hechos = pedidos
    .filter((p) => p.estado === "finalizado")
    .sort((a, b) => new Date(b.finalizado_en) - new Date(a.finalizado_en));

  $("tickets").replaceChildren(...pendientes.map(renderTicket));
  $("vacio").hidden = pendientes.length > 0;
  $("count-pendientes").textContent = pendientes.length;

  $("lista-hechos").replaceChildren(...hechos.map(renderHecho));
  $("hechos-vacio").hidden = hechos.length > 0;

  $("stat-pendientes").textContent = pendientes.length;
  $("stat-finalizados").textContent = hechos.length;
  const esperas = pendientes.map((p) => minutosDesde(p.creado_en));
  $("stat-espera").textContent = esperas.length
    ? textoEspera(Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length))
    : "–";

  document.title = pendientes.length ? `(${pendientes.length}) Il Forno · Comandas` : "Il Forno · Comandas";
}

// Actualiza los contadores de espera sin redibujar todo
function refrescarTiempos() {
  document.querySelectorAll(".ticket").forEach((t) => {
    const espera = t.querySelector(".espera");
    const min = minutosDesde(espera.dataset.creado);
    espera.textContent = textoEspera(min);
    t.dataset.urgencia = urgencia(min);
  });
  const esperas = [...document.querySelectorAll(".espera")].map((e) => minutosDesde(e.dataset.creado));
  $("stat-espera").textContent = esperas.length
    ? textoEspera(Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length))
    : "–";
  $("reloj").textContent = fmtHora.format(new Date());
}

// ---------- datos ----------
async function cargar() {
  try {
    const res = await fetch("/api/pedidos", { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    const datos = await res.json();

    if (idsConocidos) {
      const nuevos = datos.filter((p) => !idsConocidos.has(p.id) && p.estado !== "finalizado");
      nuevos.forEach((p) => {
        idsNuevos.add(p.id);
        setTimeout(() => idsNuevos.delete(p.id), 4000);
        toast(`Nuevo pedido #${p.id} · ${p.nombre_cliente}`, "nuevo");
      });
      if (nuevos.length) sonar();
    }
    idsConocidos = new Set(datos.map((p) => p.id));
    pedidos = datos;
    render();
  } catch (err) {
    toast(`No se han podido cargar los pedidos: ${err.message}`, "error");
  }
}

let cargaPendiente = null;
function cargarPronto() {
  clearTimeout(cargaPendiente);
  cargaPendiente = setTimeout(cargar, 150);
}

async function cambiarEstado(id, accion) {
  const res = await fetch(`/api/pedidos/${id}/${accion}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const actualizado = await res.json();
  pedidos = pedidos.map((p) => (p.id === actualizado.id ? actualizado : p));
}

async function finalizar(id, ticket, boton) {
  boton.disabled = true;
  try {
    await cambiarEstado(id, "finalizar");
    ticket.classList.add("saliendo");
    setTimeout(render, 330);
  } catch (err) {
    boton.disabled = false;
    toast(`No se ha podido finalizar el pedido #${id}: ${err.message}`, "error");
  }
}

async function reabrir(id, boton) {
  boton.disabled = true;
  try {
    await cambiarEstado(id, "reabrir");
    render();
  } catch (err) {
    boton.disabled = false;
    toast(`No se ha podido reabrir el pedido #${id}: ${err.message}`, "error");
  }
}

// ---------- tiempo real ----------
function estadoConexion(estado, texto) {
  $("live").dataset.estado = estado;
  $("live-texto").textContent = texto;
}

function conectar() {
  const es = new EventSource("/api/stream");
  es.addEventListener("open", () => {
    estadoConexion("ok", "En directo");
    cargar();
  });
  es.addEventListener("cambio", cargarPronto);
  es.addEventListener("error", () => estadoConexion("error", "Reconectando…"));
}

// ---------- sonido ----------
let audioCtx = null;
function sonar() {
  if (!sonidoActivo) return;
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const ahora = audioCtx.currentTime;
  [[880, 0], [1320, 0.16]].forEach(([freq, t]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ahora + t);
    gain.gain.exponentialRampToValueAtTime(0.35, ahora + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + t + 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(ahora + t);
    osc.stop(ahora + t + 0.5);
  });
}

function pintarBotonSonido() {
  $("btn-sonido").setAttribute("aria-pressed", String(sonidoActivo));
  $("btn-sonido-texto").textContent = sonidoActivo ? "Sonido on" : "Sonido off";
}

$("btn-sonido").addEventListener("click", () => {
  sonidoActivo = !sonidoActivo;
  try { localStorage.setItem("comandas-sonido", sonidoActivo ? "1" : "0"); } catch { /* sin storage */ }
  pintarBotonSonido();
  sonar();
});

// ---------- toasts ----------
function toast(texto, tipo = "") {
  const t = h("div", { class: `toast ${tipo}` }, texto);
  $("toasts").append(t);
  setTimeout(() => {
    t.classList.add("fuera");
    setTimeout(() => t.remove(), 300);
  }, tipo === "error" ? 7000 : 5000);
}

// ---------- arranque ----------
try { sonidoActivo = localStorage.getItem("comandas-sonido") === "1"; } catch { /* sin storage */ }
pintarBotonSonido();
refrescarTiempos();
setInterval(refrescarTiempos, 20000);
setInterval(cargar, 60000);   // red de seguridad por si se pierde algun aviso
conectar();
