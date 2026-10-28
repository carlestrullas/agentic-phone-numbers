"use strict";

// Kitchen order board. UI text is in Spanish (it is read by the pizzeria staff);
// the data fields (nombre_cliente, tipo_entrega, ...) come from the `pedidos` table.

const $ = (id) => document.getElementById(id);
const WARN_MINUTES = 15;   // waiting time that turns the ticket yellow
const ALERT_MINUTES = 30;  // waiting time that turns the ticket red

let orders = [];
let knownIds = null;       // null until the first load, so existing orders do not trigger alerts
const newIds = new Set();
let soundOn = false;

// ---------- helpers ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function svg(markup, cls) {
  const t = document.createElement("template");
  t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ""}>${markup}</svg>`;
  return t.content.firstChild;
}

const ICONS = {
  scooter: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h7l-3-7H9M15 6h3l2.5 8M5.5 14l2-4h3"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
};

const fmtTime = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

function minutesSince(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

function waitText(min) {
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  return `${hours} h ${String(min % 60).padStart(2, "0")} min`;
}

function urgency(min) {
  if (min >= ALERT_MINUTES) return "high";
  if (min >= WARN_MINUTES) return "medium";
  return "low";
}

function orderItems(o) {
  let items = o.productos;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return Array.isArray(items) ? items : [];
}

function averageWait(minutes) {
  return minutes.length
    ? waitText(Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length))
    : "–";
}

// ---------- render ----------
function renderTicket(o) {
  const min = minutesSince(o.creado_en);
  const isDelivery = o.tipo_entrega === "domicilio";
  const phone = String(o.telefono || "").replace(/[^\d+]/g, "");

  const items = orderItems(o).map((it) =>
    h("li", {},
      h("span", { class: "qty" }, `${it.cantidad || 1}×`),
      h("span", { class: "item" }, it.producto || "Producto", it.tamano ? h("span", { class: "size" }, it.tamano) : null),
      it.notas ? h("span", { class: "item-note" }, it.notas) : null
    )
  );

  const button = h("button", { class: "btn-complete", type: "button", onclick: () => complete(o.id, ticket, button) },
    svg(ICONS.check), "Marcar como finalizado");

  const ticket = h("article", {
      class: "ticket" + (newIds.has(o.id) ? " new" : ""),
      dataset: { id: o.id, type: o.tipo_entrega, urgency: urgency(min) },
      "aria-label": `Pedido ${o.id} de ${o.nombre_cliente}`,
    },
    h("div", { class: "ticket-top" },
      h("div", { class: "number" }, h("small", {}, "#"), o.id),
      h("div", { class: "times" },
        h("time", { class: "time", datetime: o.creado_en }, fmtTime.format(new Date(o.creado_en))),
        h("span", { class: "wait", dataset: { created: o.creado_en } }, waitText(min))
      )
    ),
    h("span", { class: `badge ${isDelivery ? "domicilio" : "recoger"}` },
      svg(isDelivery ? ICONS.scooter : ICONS.bag), isDelivery ? "A domicilio" : "Para recoger"),
    h("div", { class: "customer" }, o.nombre_cliente),
    h("div", { class: "contact" },
      phone ? h("a", { href: `tel:${phone}` }, o.telefono) : null,
      isDelivery && o.direccion ? h("span", {}, o.direccion) : null
    ),
    items.length ? h("ul", { class: "items" }, items) : null,
    o.notas ? h("p", { class: "order-note" }, svg(ICONS.note), o.notas) : null,
    button
  );
  return ticket;
}

function renderDone(o) {
  const btn = h("button", { class: "btn-undo", type: "button", onclick: () => reopen(o.id, btn) }, "Deshacer");
  return h("li", {},
    h("span", { class: "check" }, svg(ICONS.check)),
    h("div", { class: "done-info" },
      h("strong", {}, `#${o.id} · ${o.nombre_cliente}`),
      h("span", {}, `Finalizado a las ${fmtTime.format(new Date(o.finalizado_en || o.creado_en))} · ` +
                    (o.tipo_entrega === "domicilio" ? "domicilio" : "recoger"))
    ),
    btn
  );
}

function render() {
  const pending = orders.filter((o) => o.estado !== "finalizado");
  const done = orders
    .filter((o) => o.estado === "finalizado")
    .sort((a, b) => new Date(b.finalizado_en) - new Date(a.finalizado_en));

  $("tickets").replaceChildren(...pending.map(renderTicket));
  $("empty").hidden = pending.length > 0;
  $("count-pending").textContent = pending.length;

  $("done-list").replaceChildren(...done.map(renderDone));
  $("done-empty").hidden = done.length > 0;

  $("stat-pending").textContent = pending.length;
  $("stat-done").textContent = done.length;
  $("stat-wait").textContent = averageWait(pending.map((o) => minutesSince(o.creado_en)));

  document.title = pending.length ? `(${pending.length}) Il Forno · Comandas` : "Il Forno · Comandas";
}

// Updates the waiting timers without re-rendering everything
function refreshTimers() {
  document.querySelectorAll(".ticket").forEach((t) => {
    const wait = t.querySelector(".wait");
    const min = minutesSince(wait.dataset.created);
    wait.textContent = waitText(min);
    t.dataset.urgency = urgency(min);
  });
  const waits = [...document.querySelectorAll(".wait")].map((e) => minutesSince(e.dataset.created));
  $("stat-wait").textContent = averageWait(waits);
  $("clock").textContent = fmtTime.format(new Date());
}

// ---------- data ----------
async function load() {
  try {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    const data = await res.json();

    if (knownIds) {
      const incoming = data.filter((o) => !knownIds.has(o.id) && o.estado !== "finalizado");
      incoming.forEach((o) => {
        newIds.add(o.id);
        setTimeout(() => newIds.delete(o.id), 4000);
        toast(`Nuevo pedido #${o.id} · ${o.nombre_cliente}`, "new");
      });
      if (incoming.length) beep();
    }
    knownIds = new Set(data.map((o) => o.id));
    orders = data;
    render();
  } catch (err) {
    toast(`No se han podido cargar los pedidos: ${err.message}`, "error");
  }
}

let pendingLoad = null;
function loadSoon() {
  clearTimeout(pendingLoad);
  pendingLoad = setTimeout(load, 150);
}

async function setStatus(id, action) {
  const res = await fetch(`/api/orders/${id}/${action}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const updated = await res.json();
  orders = orders.map((o) => (o.id === updated.id ? updated : o));
}

async function complete(id, ticket, button) {
  button.disabled = true;
  try {
    await setStatus(id, "complete");
    ticket.classList.add("leaving");
    setTimeout(render, 330);
  } catch (err) {
    button.disabled = false;
    toast(`No se ha podido finalizar el pedido #${id}: ${err.message}`, "error");
  }
}

async function reopen(id, button) {
  button.disabled = true;
  try {
    await setStatus(id, "reopen");
    render();
  } catch (err) {
    button.disabled = false;
    toast(`No se ha podido reabrir el pedido #${id}: ${err.message}`, "error");
  }
}

// ---------- real time ----------
function connectionState(state, text) {
  $("live").dataset.state = state;
  $("live-text").textContent = text;
}

function connect() {
  const es = new EventSource("/api/stream");
  es.addEventListener("open", () => {
    connectionState("ok", "En directo");
    load();
  });
  es.addEventListener("change", loadSoon);
  es.addEventListener("error", () => connectionState("error", "Reconectando…"));
}

// ---------- sound ----------
let audioCtx = null;
function beep() {
  if (!soundOn) return;
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  [[880, 0], [1320, 0.16]].forEach(([freq, t]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.5);
  });
}

function paintSoundButton() {
  $("btn-sound").setAttribute("aria-pressed", String(soundOn));
  $("btn-sound-text").textContent = soundOn ? "Sonido on" : "Sonido off";
}

$("btn-sound").addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem("orders-sound", soundOn ? "1" : "0"); } catch { /* no storage */ }
  paintSoundButton();
  beep();
});

// ---------- toasts ----------
function toast(text, kind = "") {
  const t = h("div", { class: `toast ${kind}` }, text);
  $("toasts").append(t);
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 300);
  }, kind === "error" ? 7000 : 5000);
}

// ---------- start ----------
try { soundOn = localStorage.getItem("orders-sound") === "1"; } catch { /* no storage */ }
paintSoundButton();
refreshTimers();
setInterval(refreshTimers, 20000);
setInterval(load, 60000);   // safety net in case a notification is missed
connect();
