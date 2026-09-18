#!/usr/bin/env node
/* A whole Coaster Hub on your laptop.
 *
 *   node tools/dev-server.mjs           →  http://127.0.0.1:8099
 *   node tools/dev-server.mjs --fresh   →  ...starting from an empty database
 *   PORT=9000 node tools/dev-server.mjs
 *
 * This replaced a stub of the same name that faked the API off the JSON files.
 * Everything it did, this does; what it could not do was auth, D1, /edit's
 * writes or anything the real Worker decides, which is most of what there now
 * is to test.
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
// PORT= is how the old stub took it, so keep that working; --port is here
// because typing it inline is easier to remember than exporting a variable.
const PORT = Number(process.env.PORT
  || (argv[argv.indexOf("--port") + 1] || "").match(/^\d+$/)?.[0]
  || 8099);
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

  // A coaster nobody has ridden. Every one of the 1,114 real ones is in
  // somebody's count, so without this the /edit delete UI can only ever show
  // its "N riders still have this — merge it instead" branch and the other half
  // of that screen is unreachable. The stub this server replaced kept id 999001
  // free for the same reason.
  ic.run(999001, "Nobody's Ridden This", "Cedar Point", "Steel", "Test", "Test",
         100, 50, 2000, 0, 90, 1, 2026, "2026-05-01", "day", null, null);

  // A feed with the shapes that have actually broken /changes before. This is
  // the one thing the old stub had that a real database does not hand you: a
  // fresh table is empty, and these rows are a regression test written as data.
  const ia = db.prepare(
    "INSERT INTO activity (at,actor,kind,subject,n,detail) VALUES (?,?,?,?,?,?)");
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const J = (o) => JSON.stringify(o);
  // Three ranking saves minutes apart: /changes has to fold these into one line.
  ia.run(ago(2),  "carter", "ranking", null, 1, J({ added:1, removed:0, reordered:false, total:108, saves:1 }));
  ia.run(ago(4),  "carter", "ranking", null, 1, J({ added:1, removed:0, reordered:false, total:107, saves:1 }));
  ia.run(ago(21), "carter", "ranking", null, 3, J({ added:3, removed:0, reordered:true,  total:106, saves:1 }));
  // Credit bursts, which fold the same way but say something different.
  ia.run(ago(30), "cole", "credits", null, 2, J({ rides:2, coasters:2, newCredits:2, date:null }));
  ia.run(ago(33), "cole", "credits", null, 1, J({ rides:1, coasters:1, newCredits:1, date:null }));
  ia.run(ago(1500), "sean", "rides", "Universal Studios Hollywood", 2,
         J({ rides:2, coasters:1, newCredits:1, date:"2026-08-02" }));
  // A rename written today carries its own park...
  ia.run(ago(300), null, "coaster_renamed", "Top Thrill 2",  null,
         J({ id:1, from:"Top Thrill Dragster", park:"Cedar Point" }));
  // ...while a backfilled one has only the coaster id, so /changes has to look
  // the park up from the coaster list. Both have to print it.
  ia.run("2026-08-05", null, "coaster_renamed", "Thunder Striker", null,
         J({ id:96, from:"Intimidator", backfilled:true }));
  ia.run("2026-08-05", null, "coaster_merged", "Batgirl Batarang", null,
         J({ id:1020, from:"Batgirl", backfilled:true }));
  // A bare date and no actor at all — the shape that used to push the day
  // headings out of order.
  ia.run("2026-07-30", null, "coaster_added", "Hyperia", null,
         J({ park:"Thorpe Park", backfilled:true }));

  console.log("seeded " + list.length + " coasters, " + Object.keys(parks).length +
              " parks, " + rides.toLocaleString() + " rides, 10 feed events");
}

// ---- the real Worker -------------------------------------------------------
// Imported from a copy so an edit to worker.js is picked up by restarting this
// script rather than by clearing a module cache.
const live = join(tmpdir(), "coasterhub-dev-worker.mjs");
await writeFile(live, readFileSync(join(ROOT, "worker.js"), "utf8"));
const mod = await import("file://" + live);
const worker = mod.default;
// The same skin the hosted scratch copy injects. worker.js only reaches its own
// copy of this through env.ASSETS, which this server does not use — it serves
// the files itself — so it has to staple it on here.
const DEV_SKIN = mod.DEV_SKIN || "";

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
// DEV_AS is what turns off accounts: the Worker treats every request as this
// rider, as an admin, and staples the plain black/white header onto every page.
// Same variable the hosted scratch copy sets, so local and staging behave and
// LOOK the same — which is the point of having both.
const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW, AVATARS: R2, DEV_AS: "carter" };
const ctx = { waitUntil() {} };

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let p = url.pathname;

  // Switch which rider you are, without a login: /__be?slug=cole. Everything
  // else about accounts is off — DEV_AS above means you arrive already signed
  // in, so there is nothing to sign into.
  if (p === "/__be") {
    const slug = (url.searchParams.get("slug") || "carter").toLowerCase();
    const known = db.prepare("SELECT slug FROM users WHERE slug = ?").get(slug);
    if (!known) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "no rider called " + slug })); return;
    }
    env.DEV_AS = slug;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, slug })); return;
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
  let out = readFileSync(file);
  if (extname(p) === ".html" && env.DEV_AS) {
    const html = String(out);
    if (html.includes("</head>")) out = Buffer.from(html.replace("</head>", DEV_SKIN + "</head>"));
  }
  res.end(out);
}).listen(PORT, () => {
  console.log("\n  Coaster Hub, locally:  http://127.0.0.1:" + PORT);
  console.log("  database:              " + DB_FILE + (FRESH ? "  (fresh)" : ""));
  console.log("  admin password:        " + PW + "   (for /edit)");
  console.log("  signed in as:          " + env.DEV_AS + "  (admin, no login needed)");
  console.log("\n  Be somebody else:      /__be?slug=cole");
  console.log("\n  --fresh wipes the database and reseeds from the repo's JSON.\n");
});
