// Runs THE SWITCH (runCutover in worker.js) without the live site: loads a
// full D1 export into node:sqlite, sends the real Worker the same POST the
// /cutover button sends, and records every write it makes as plain SQL, which
// the cutover workflow then applies to the live database with wrangler.
// Written 2026-11-19 because the sandbox cannot reach coasterhub.org and
// Carter said "You can just do it".
//
//   node tools/cutover-run.mjs <dump.sql | copy.db> <out.sql> [--dry]
//
// --dry prints what the switch would do and writes nothing. The recorded SQL
// starts with the switch's own backups (CREATE TABLE <t>_rcdb_backup AS ...),
// so the live database is backed up before anything changes.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [src, out] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
if (!src || !out) { console.error("usage: node tools/cutover-run.mjs <dump.sql|copy.db> <out.sql> [--dry]"); process.exit(2); }

let db;
if (src.endsWith(".db")) {
  const tmp = join(tmpdir(), "cutover-" + process.pid + ".db");
  copyFileSync(src, tmp);
  db = new DatabaseSync(tmp);
} else {
  db = new DatabaseSync(":memory:");
  db.exec(readFileSync(src, "utf8"));
}

const writes = [];
const lit = v => v === null || v === undefined ? "NULL"
  : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "NULL")
  : typeof v === "bigint" ? String(v)
  : "'" + String(v).replace(/'/g, "''") + "'";
function inline(sql, args) {
  let i = 0;
  return sql.replace(/\?/g, () => lit(args[i++]));
}
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
const env = { DB, ADMIN_PASSWORD: "cutover-local-only" };
const req = new Request("https://coasterhub.org/api/cutover/switch", {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-token": env.ADMIN_PASSWORD },
  body: JSON.stringify(dry ? { dry: true } : { dry: false, confirm: "SWITCH" }),
});
const res = await worker.fetch(req, env, { waitUntil() {}, passThroughOnException() {} });
const body = await res.json();
const { removedList, hiddenParks, ...summary } = body;
console.log(JSON.stringify(summary, null, 1));
if (!res.ok) { console.error("the switch refused: " + (body.error || res.status)); process.exit(1); }
if (removedList) console.log("removed: " + removedList.length + ", parks hidden: " + hiddenParks.length);
if (!dry) {
  writeFileSync(out, writes.map(w => w.trim().replace(/;$/, "") + ";").join("\n") + "\n");
  const backups = writes.filter(w => /_rcdb_backup AS SELECT/i.test(w)).length;
  console.log(writes.length + " statements -> " + out + " (" + backups + " backup tables first)");
}
