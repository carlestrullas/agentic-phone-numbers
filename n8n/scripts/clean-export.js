// Limpia los workflows exportados por `n8n export:workflow --separate` para versionarlos en Git:
// quita campos que cambian en cada guardado (fechas, versiones, contadores...) y
// guarda cada workflow como <nombre-del-workflow>.json.
// Se ejecuta dentro del contenedor de n8n:  node clean-export.js <dir-entrada> <dir-salida>
const fs = require("fs");
const path = require("path");

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error("Uso: node clean-export.js <dir-entrada> <dir-salida>");
  process.exit(1);
}

const CAMPOS = ["id", "name", "active", "nodes", "connections", "settings"];

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";

fs.mkdirSync(salida, { recursive: true });
const usados = new Set();
let n = 0;

for (const f of fs.readdirSync(entrada).filter((f) => f.endsWith(".json")).sort()) {
  const datos = JSON.parse(fs.readFileSync(path.join(entrada, f), "utf8"));
  for (const wf of Array.isArray(datos) ? datos : [datos]) {
    if (wf.isArchived) continue; // los archivados no se versionan
    const limpio = {};
    for (const c of CAMPOS) if (wf[c] !== undefined) limpio[c] = wf[c];

    let nombre = slug(wf.name);
    if (usados.has(nombre)) nombre = `${nombre}-${wf.id}`;
    usados.add(nombre);

    fs.writeFileSync(path.join(salida, `${nombre}.json`), JSON.stringify(limpio, null, 2) + "\n");
    console.log(`  ${nombre}.json  (${wf.name})`);
    n++;
  }
}
console.log(`${n} workflow(s) exportado(s)`);
