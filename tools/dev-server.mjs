#!/usr/bin/env node
/* A whole Coaster Hub on your laptop.
 *
 *   node tools/dev-server.mjs           →  http://127.0.0.1:8100
 *   node tools/dev-server.mjs --fresh   →  ...starting from an empty database
 *   node tools/dev-server.mjs --port 9000
 *
 * It serves the repo's files exactly as Cloudflare does — the same pretty URLs,
 * the same rewrites — and runs the REAL worker.js for /api/* and /avatars/*,
 * with node:sqlite standing in for D1. So auth, rankings, the log, /edit and
 * the admin endpoints all behave the way production does, against data you can
 * break without consequence.
 *
 * Where the data comes from: the repo's own exports. coasters.json and
 * parks.json are the real shared list, and each <rider>.json is that rider's
 * real ride history — so a Batman family or a Wacky Worm pile-up looks exactly
 * the way it looks on the live site.
 *
 * The database is a FILE (.dev.db, gitignored), so what you build survives a
 * restart. --fresh throws it away and reseeds.
 *
 * Needs nothing installed: node 22+ for node:sqlite, and that is it.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const PORT = Number((argv[argv.indexOf("--port") + 1] || "").match(/^\d+$/)?.[0] || 8100);
const FRESH = argv.includes("--fresh");
const DB_FILE = join(ROOT, ".dev.db");
const PW = "letmein";                       // the admin password locally; never production's

// ---- D1, faked over node:sqlite --------------------------------------------
// The same three methods worker.js uses, and nothing else. If the Worker ever
// reaches for a fourth, this is where it will tell you.
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...a) { this.args = a; return this; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async first() { const r = this.db.prepare(this.sql).get(...this.args); return r === undefined ? null : r; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
class FakeD1 {
  constructor(db) { this.db = db; }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(s) { const o = []; for (const x of s) o.push(await x.run()); return o; }
}

// ---- the database ----------------------------------------------------------
if (FRESH && existsSync(DB_FILE)) rmSync(DB_FILE);
const seeding = !existsSync(DB_FILE);
const db = new DatabaseSync(DB_FILE);

// The tables the early migrations made, written out longhand: 001-009 are data
// fixes against a shape that no longer exists anywhere, so there is nothing to
// replay. Everything from 010 on IS replayed from the file below, which means a
// migration that is not re-runnable fails here rather than in the D1 console.
db.exec(`
  CREATE TABLE IF NOT EXISTS coasters (id INTEGER PRIMARY KEY, name TEXT, park TEXT, type TEXT,
    manu TEXT, model TEXT, h REAL, s REAL, l REAL, inv INTEGER, dur INTEGER, laps INTEGER,
    yr INTEGER, opened TEXT, openedPrec TEXT, closed TEXT, closedPrec TEXT);
  CREATE TABLE IF NOT EXISTS parks (name TEXT PRIMARY KEY, lat REAL, lon REAL, region TEXT);
  CREATE TABLE IF NOT EXISTS users (slug TEXT PRIMARY KEY, name TEXT, mode TEXT,
    email TEXT, bio TEXT, avatar TEXT);
  CREATE TABLE IF NOT EXISTS rides (id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_slug TEXT, coaster_id INTEGER, d TEXT);
  CREATE TABLE IF NOT EXISTS rankings (user_slug TEXT PRIMARY KEY, ord TEXT, updated TEXT);
  CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT, actor TEXT, kind TEXT, subject TEXT, n INTEGER, detail TEXT);
  CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE, pw TEXT, slug TEXT UNIQUE, is_admin INTEGER DEFAULT 0, created TEXT);
  CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER, token TEXT UNIQUE, created TEXT, seen TEXT);
  CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, slug TEXT NOT NULL,
    created TEXT NOT NULL, used TEXT);
  CREATE TABLE IF NOT EXISTS resets (token TEXT PRIMARY KEY, account_id INTEGER,
    created TEXT, used TEXT);
  -- Renames keep the old name working, and /api/coasters reads both of these on
  -- every request — without them the shared list 500s and nothing loads.
  CREATE TABLE IF NOT EXISTS coaster_aliases (coaster_id INTEGER, former_name TEXT);
  CREATE TABLE IF NOT EXISTS park_aliases (park TEXT, former_name TEXT);
`);

// Schema migrations, applied in order and applied TWICE — the file claims to be
// re-runnable and this is where that claim gets tested. Add new ones here.
const SCHEMA = ["010-follows.sql", "012-clone-groups.sql"];
for (const f of SCHEMA) {
  const p = join(ROOT, "migrations", f);
  if (!existsSync(p)) { console.warn("! missing migration " + f); continue; }
  const sql = readFileSync(p, "utf8");
  try { db.exec(sql); db.exec(sql); }
  catch (e) { console.error("! " + f + " failed: " + e.message); process.exit(1); }
}

if (seeding) seed();

function seed() {
  // The real shared list, so what you are testing against is what is live.
  const coasters = JSON.parse(readFileSync(join(ROOT, "coasters.json"), "utf8"));
  const list = Array.isArray(coasters) ? coasters : (coasters.coasters || []);
  const parks = JSON.parse(readFileSync(join(ROOT, "parks.json"), "utf8"));

  const ip = db.prepare("INSERT OR REPLACE INTO parks (name,lat,lon,region) VALUES (?,?,?,?)");
  for (const [name, p] of Object.entries(parks)) ip.run(name, p.lat ?? null, p.lon ?? null, p.region ?? null);

  const ic = db.prepare(
    "INSERT OR REPLACE INTO coasters (id,name,park,type,manu,model,h,s,l,inv,dur,laps,yr," +
    "opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const c of list) {
    ic.run(c.id, c.name ?? null, c.park ?? null, c.type ?? null, c.manu ?? null, c.model ?? null,
      c.h ?? null, c.s ?? null, c.l ?? null, c.inv ?? null, c.dur ?? null, c.laps ?? null,
      c.yr ?? null, c.opened ?? null, c.openedPrec ?? null, c.closed ?? null, c.closedPrec ?? null);
  }

  // Every rider whose export is in the repo. The file is named for the slug,
  // except Carter's, which is still under the name the site launched with.
  const RIDERS = [["crblanchard.json", "carter", "Carter"], ["cole.json", "cole", "Cole"],
                  ["max.json", "max", "Max"], ["sean.json", "sean", "Sean"],
                  ["keltan.json", "keltan", "Keltan"]];
  const iu = db.prepare("INSERT OR REPLACE INTO users (slug,name,mode) VALUES (?,?,'rides')");
  const ir = db.prepare("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)");
  let rides = 0;
  for (const [file, slug, name] of RIDERS) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const j = JSON.parse(readFileSync(p, "utf8"));
    iu.run(slug, j.user || name);
    for (const r of (j.rides || [])) { ir.run(slug, r.c, r.d ?? null); rides++; }
  }

  console.log("seeded " + list.length + " coasters, " + Object.keys(parks).length +
              " parks, " + rides.toLocaleString() + " rides");
}

// ---- the real Worker -------------------------------------------------------
// Imported from a copy so an edit to worker.js is picked up by restarting this
// script rather than by clearing a module cache.
const live = join(tmpdir(), "coasterhub-dev-worker.mjs");
await writeFile(live, readFileSync(join(ROOT, "worker.js"), "utf8"));
const worker = (await import("file://" + live)).default;

// R2, faked: avatars live in a Map for as long as the process does.
const bucket = new Map();
const R2 = {
  async put(k, v) { bucket.set(k, Buffer.from(v)); return { key: k }; },
  async get(k) {
    const b = bucket.get(k);
    return b ? { body: b, httpMetadata: {}, arrayBuffer: async () => b } : null;
  },
  async delete(k) { bucket.delete(k); },
};
const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW, AVATARS: R2 };
const ctx = { waitUntil() {} };

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let p = url.pathname;

  // A back door for setting up a scenario without clicking through the UI.
  // Local only, and it is why this script must never be pointed at real data.
  if (p === "/__admin") {
    db.exec("UPDATE accounts SET is_admin = 1");
    res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); return;
  }
  if (p === "/__be") {
    // Become a rider: attach your newest account to their slug, so you can edit
    // Carter's ranking without inventing a login for him.
    const slug = (url.searchParams.get("slug") || "carter").toLowerCase();
    try {
      db.exec("UPDATE accounts SET slug = NULL WHERE slug = '" + slug.replace(/'/g, "") + "'");
      db.prepare("UPDATE accounts SET slug = ? WHERE id = (SELECT MAX(id) FROM accounts)").run(slug);
      res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true,"slug":"' + slug + '"}');
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (p.startsWith("/api/") || p.startsWith("/avatars/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await worker.fetch(new Request("https://coasterhub.org" + req.url, {
      method: req.method, headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    }), env, ctx);
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    // The browser is on http://127.0.0.1, which silently drops a Secure cookie
    // — and then nothing you do stays signed in.
    if (h["set-cookie"]) h["set-cookie"] = h["set-cookie"].replace(/; Secure/i, "");
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
  }

  // The same rewrites _redirects does, so a pretty URL behaves here as it will
  // live. Keep the two in step: a route that works only in one of them is worse
  // than a route that works in neither.
  const st = p.match(/^(\/user\/[^/]+)\/stats$/);
  if (st) { res.writeHead(301, { location: st[1] }); res.end(); return; }
  const rd = p.match(/^(\/user\/[^/]+)?\/rides$/);
  if (rd) { res.writeHead(301, { location: (rd[1] || "") + "/count" }); res.end(); return; }
  if (p === "/stats") { res.writeHead(301, { location: "/" }); res.end(); return; }
  if (p === "/home" || p === "/riders") { res.writeHead(301, { location: "/" }); res.end(); return; }
  if (p === "/rankings/all") p = "/rankings-all.html";
  const m = p.match(/^\/user\/[^/]+(\/.*)?$/);
  if (m) p = m[1] && m[1] !== "/" ? m[1] : "/profile";
  if (p === "/") p = "/index.html";
  if (!extname(p)) p += ".html";

  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream",
                       "cache-control": "no-store" });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log("\n  Coaster Hub, locally:  http://127.0.0.1:" + PORT);
  console.log("  database:              " + DB_FILE + (FRESH ? "  (fresh)" : ""));
  console.log("  admin password:        " + PW + "   (for /edit)");
  console.log("\n  Make an account at /account, then:");
  console.log("    http://127.0.0.1:" + PORT + "/__admin           make it an admin");
  console.log("    http://127.0.0.1:" + PORT + "/__be?slug=carter  and make it Carter");
  console.log("\n  --fresh wipes the database and reseeds from the repo's JSON.\n");
});
