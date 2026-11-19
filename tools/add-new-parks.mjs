// Adds every "ready" new park from /sources/review, exactly as pressing "Add
// all ticked parks" with the page's defaults would (Carter, 2026-11-19: "add
// all the new parks please"). Ready = a map pin, a region, a Latin-script
// name, and not already a park here; ticked coasters = the ones a source says
// are operating or being built ("standing but not operating" is closed).
//
// Like tools/cutover-run.mjs: loads a full D1 export into node:sqlite, sends
// the real Worker the same requests the page sends, and records every write
// as SQL for the workflow to apply to the live database.
//
//   node tools/add-new-parks.mjs <dump.sql | copy.db> <out.sql> [--dry] [--spec bodies.json]
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [src, out] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
if (!src || !out) { console.error("usage: node tools/add-new-parks.mjs <dump.sql|copy.db> <out.sql> [--dry]"); process.exit(2); }
let db;
if (src.endsWith(".db")) { const t = join(tmpdir(), "parks-" + process.pid + ".db"); copyFileSync(src, t); db = new DatabaseSync(t); }
else { db = new DatabaseSync(":memory:"); db.exec(readFileSync(src, "utf8")); }

const writes = [];
const lit = v => v === null || v === undefined ? "NULL" : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "NULL")
  : typeof v === "bigint" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const inline = (sql, args) => { let i = 0; return sql.replace(/\?/g, () => lit(args[i++])); };
class Stmt {
  constructor(sql) { this.sql = sql; this.args = []; }
  bind(...a) { this.args = a; return this; }
  async all() { return { results: db.prepare(this.sql).all(...this.args) }; }
  async first() { const r = db.prepare(this.sql).get(...this.args); return r === undefined ? null : r; }
  async run() {
    const r = db.prepare(this.sql).run(...this.args);
    if (!/^\s*select\b/i.test(this.sql)) writes.push(inline(this.sql, this.args));
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
const DB = { prepare: sql => new Stmt(sql), batch: async s => { const o = []; for (const x of s) o.push(await x.run()); return o; } };
const worker = (await import("../worker.js")).default;
const env = { DB, ADMIN_PASSWORD: "local-only" };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const call = async (method, path, body) => {
  const res = await worker.fetch(new Request("https://coasterhub.org" + path, {
    method, headers: { "content-type": "application/json", "x-admin-token": env.ADMIN_PASSWORD }, body: body ? JSON.stringify(body) : undefined,
  }), env, ctx);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || res.status);
  return j;
};

// --spec <file.json>: send exactly these /api/cutover/apply bodies instead
// (a hand-made fix, like the Oriental Heritage split in migration 198).
const si = process.argv.indexOf("--spec");
if (si > 0) {
  const bodies = JSON.parse(readFileSync(process.argv[si + 1], "utf8"));
  let n = 0; const bad = [];
  for (const b of bodies) {
    if (dry) { n++; continue; }
    try { const r = await call("POST", "/api/cutover/apply", b); n += r.done.length || 0; }
    catch (e) { bad.push((b.name || b.park) + " @ " + b.park + ": " + e.message); }
  }
  console.log((dry ? "would send " + n + " requests" : "added " + n + " coasters") + (bad.length ? "\nnot added:\n  " + bad.join("\n  ") : ""));
  if (!dry) { writeFileSync(out, writes.map(w => w.trim().replace(/;$/, "") + ";").join("\n") + "\n"); console.log(writes.length + " statements -> " + out); }
  process.exit(0);
}

const latin = n => !/[^\u0000-ɏḀ-ỿ‐-‧€]/.test(n || "");
const alive = c => !/not operat|nicht in betrieb|sbno/i.test(c.status || "") && /operat|construct|open|betrieb/i.test(c.status || "");
const review = await call("GET", "/api/cutover/review");
const notPark = p => /^(standalone|travel+ing|none|unknown)$/i.test(p.park.trim()) || /state ?fair|county ?fair|kermis|kirmes|volksfest/i.test(p.park);
const ready = review.newParks.filter(p => p.lat != null && p.region && latin(p.park) && !p.taken && !notPark(p));
let parks = 0, coasters = 0;
const failed = [], seen = new Set();
for (const p of ready) {
  const cs = p.coasters.filter(alive).map(c => ({ name: c.name, refs: c.refs.map(r => ({ source: r.source, ref: r.ref })) }));
  if (!cs.length) continue;
  // Two ready parks with one name (VinWonders): the first goes in, the next
  // waits for a name on the page.
  if (seen.has(p.park.toLowerCase())) { failed.push(p.park + ": same name as another new park, rename it on the page"); continue; }
  seen.add(p.park.toLowerCase());
  if (dry) { parks++; coasters += cs.length; continue; }
  try {
    const r = await call("POST", "/api/cutover/apply", { kind: "addpark", k: p.k, park: p.park, region: p.region, lat: p.lat, lon: p.lon, coasters: cs });
    parks++; coasters += r.done.length;
  } catch (e) { failed.push(p.park + ": " + e.message); }
}
console.log((dry ? "would add " : "added ") + parks + " parks with " + coasters + " coasters (of " + ready.length + " ready, " + review.newParks.length + " listed)");
if (failed.length) console.log("not added (" + failed.length + "):\n  " + failed.join("\n  "));
if (!dry) { writeFileSync(out, writes.map(w => w.trim().replace(/;$/, "") + ";").join("\n") + "\n"); console.log(writes.length + " statements -> " + out); }
