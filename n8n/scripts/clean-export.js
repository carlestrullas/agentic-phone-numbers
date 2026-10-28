// Cleans the workflows exported by `n8n export:workflow --separate` so they can be versioned in Git:
// drops fields that change on every save (timestamps, versions, counters...) and
// writes each workflow as <workflow-name>.json.
// Runs inside the n8n container:  node clean-export.js <input-dir> <output-dir>
const fs = require("fs");
const path = require("path");

const [inputDir, outputDir] = process.argv.slice(2);
if (!inputDir || !outputDir) {
  console.error("Usage: node clean-export.js <input-dir> <output-dir>");
  process.exit(1);
}

const FIELDS = ["id", "name", "active", "nodes", "connections", "settings"];

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";

fs.mkdirSync(outputDir, { recursive: true });
const used = new Set();
let count = 0;

for (const f of fs.readdirSync(inputDir).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(inputDir, f), "utf8"));
  for (const wf of Array.isArray(data) ? data : [data]) {
    if (wf.isArchived) continue; // archived workflows are not versioned
    const clean = {};
    for (const k of FIELDS) if (wf[k] !== undefined) clean[k] = wf[k];

    let name = slug(wf.name);
    if (used.has(name)) name = `${name}-${wf.id}`;
    used.add(name);

    fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(clean, null, 2) + "\n");
    console.log(`  ${name}.json  (${wf.name})`);
    count++;
  }
}
console.log(`${count} workflow(s) exported`);
