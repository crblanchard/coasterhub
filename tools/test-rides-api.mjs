#!/usr/bin/env node
/* Endpoint tests for the ride-log API in worker.js.
 *
 * Runs the REAL worker router against node:sqlite standing in for D1 — no
 * network, no wrangler, no npm install. Covers auth, validation (a bad batch
 * must write nothing), the write paths for both rider modes, delete, and a
 * regression pass over the endpoints the rest of the site depends on.
 *
 * Usage (worker.js uses `export default` but the repo has no "type":"module",
 * so it has to be imported under an .mjs name):
 *
 *   cp worker.js /tmp/worker.mjs && node tools/test-rides-api.mjs
 *
 * Don't "fix" that by adding "type":"module" to a package.json — wrangler is
 * happy as-is and changing it risks the deploy.
 */
import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PW = "test-password";

// ---- D1 shim over node:sqlite ---------------------------------------------
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...a) { this.args = a; return this; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async first() { const r = this.db.prepare(this.sql).get(...this.args); return r === undefined ? null : r; }
  async run() { this.db.prepare(this.sql).run(...this.args); return {}; }
}
class FakeD1 {
  constructor(db) { this.db = db; }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
}

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE coasters (id INTEGER PRIMARY KEY, name TEXT, park TEXT, type TEXT, manu TEXT,
      model TEXT, h REAL, s REAL, l REAL, inv INTEGER, dur INTEGER, laps INTEGER, yr INTEGER,
      opened TEXT, openedPrec TEXT, closed TEXT, closedPrec TEXT);
    CREATE TABLE parks (name TEXT PRIMARY KEY, lat REAL, lon REAL, region TEXT);
    CREATE TABLE users (slug TEXT PRIMARY KEY, name TEXT, mode TEXT, email TEXT, created TEXT);
    CREATE TABLE rides (id INTEGER PRIMARY KEY AUTOINCREMENT, user_slug TEXT NOT NULL,
      coaster_id INTEGER NOT NULL, d TEXT);
    CREATE TABLE credits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_slug TEXT NOT NULL,
      coaster_id INTEGER NOT NULL, first TEXT, num INTEGER, n INTEGER,
      UNIQUE(user_slug, coaster_id));
    CREATE TABLE rankings (user_slug TEXT NOT NULL, coaster_id INTEGER NOT NULL,
      pos INTEGER NOT NULL, PRIMARY KEY (user_slug, coaster_id));
    INSERT INTO coasters (id,name,park,type) VALUES
      (1,'Steel Vengeance','Cedar Point','Steel'),
      (2,'Millennium Force','Cedar Point','Steel'),
      (3,'Blue Streak','Cedar Point','Wood');
    INSERT INTO parks (name,lat,lon,region) VALUES ('Cedar Point',41.483,-82.683,'Ohio, US');
    INSERT INTO users (slug,name,mode) VALUES ('carter','Carter','rides'),('cole','Cole','credits'),('max','Max','credits');
    INSERT INTO rides (user_slug,coaster_id,d) VALUES ('carter',1,'2024-06-01'),('carter',1,'2024-06-01'),('carter',2,'2024-06-02');
    INSERT INTO credits (user_slug,coaster_id,first,num,n) VALUES ('cole',1,'2023-05-05',NULL,2),('max',1,NULL,7,NULL);
  `);
  return db;
}

// ---- harness ---------------------------------------------------------------
let worker, pass = 0, fail = 0;
const ctx = { waitUntil() {} };

async function call(db, method, path, { body, token } = {}) {
  const headers = {};
  if (token) headers["x-admin-token"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = new Request("https://coasterhub.org" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW };
  const res = await worker.fetch(req, env, ctx);
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

function check(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
}
const rows = (db, sql) => db.prepare(sql).all();

// ---- tests -----------------------------------------------------------------
async function main() {
  const tmp = join(tmpdir(), "coasterhub-worker-test.mjs");
  await writeFile(tmp, await readFile(join(ROOT, "worker.js"), "utf8"));
  worker = (await import("file://" + tmp)).default;

  console.log("\nGET /api/rides/:slug");
  {
    const db = freshDb();
    const r = await call(db, "GET", "/api/rides/carter");
    check("rides-mode returns every ride with a row id", r.status === 200 && r.data.mode === "rides"
      && r.data.rides.length === 3 && r.data.rides.every(x => Number.isInteger(x.i)), JSON.stringify(r.data));
    check("rides-mode carries user name", r.data.user === "Carter");

    const c = await call(db, "GET", "/api/rides/cole");
    check("credits-mode projected into the same shape (d = first-ridden)",
      c.status === 200 && c.data.mode === "credits" && c.data.rides[0].c === 1
      && c.data.rides[0].d === "2023-05-05" && c.data.rides[0].i === undefined, JSON.stringify(c.data));

    const m = await call(db, "GET", "/api/rides/max");
    check("credits-mode keeps credit numbers", m.data.rides[0].num === 7);

    const x = await call(db, "GET", "/api/rides/nobody");
    check("unknown rider 404s", x.status === 404);
  }

  console.log("\nPOST /api/rides — auth + validation");
  {
    const db = freshDb();
    const before = rows(db, "SELECT * FROM rides").length;
    let r = await call(db, "POST", "/api/rides", { body: { user: "carter", d: "2026-07-28", entries: [{ c: 1, n: 1 }] } });
    check("no token -> 401", r.status === 401);
    r = await call(db, "POST", "/api/rides", { token: "wrong", body: { user: "carter", d: "2026-07-28", entries: [{ c: 1, n: 1 }] } });
    check("wrong token -> 401", r.status === 401);
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "07/28/2026", entries: [{ c: 1, n: 1 }] } });
    check("bad date -> 400", r.status === 400);
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "2026-07-28", entries: [] } });
    check("empty entries -> 400", r.status === 400);
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "nope", d: "2026-07-28", entries: [{ c: 1, n: 1 }] } });
    check("unknown rider -> 400", r.status === 400);
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "2026-07-28", entries: [{ c: 1, n: 1 }, { c: 9999, n: 1 }] } });
    check("unknown coaster id -> 400", r.status === 400);
    check("...and the whole batch wrote NOTHING", rows(db, "SELECT * FROM rides").length === before,
      "rides went " + before + " -> " + rows(db, "SELECT * FROM rides").length);
  }

  console.log("\nPOST /api/rides — rides-mode writes");
  {
    const db = freshDb();
    const r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "2026-07-28", entries: [{ c: 1, n: 3 }, { c: 3, n: 1 }] } });
    check("one row per lap", rows(db, "SELECT * FROM rides WHERE d='2026-07-28'").length === 4);
    check("reports added + new grand total", r.data.added === 4 && r.data.total === 7, JSON.stringify(r.data));
    check("echoes the date", r.data.date === "2026-07-28");

    await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "2026-07-29", entries: [{ c: 2, n: 500 }] } });
    check("laps clamp at 50", rows(db, "SELECT * FROM rides WHERE d='2026-07-29'").length === 50);
    await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "2026-07-30", entries: [{ c: 2, n: 0 }] } });
    check("laps below 1 become 1", rows(db, "SELECT * FROM rides WHERE d='2026-07-30'").length === 1);
  }

  console.log("\nPOST /api/rides — credits-mode upsert");
  {
    const db = freshDb();
    await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: "2026-07-28", entries: [{ c: 2, n: 2 }] } });
    const fresh = db.prepare("SELECT * FROM credits WHERE user_slug='cole' AND coaster_id=2").get();
    check("new credit inserted with date + laps", fresh && fresh.first === "2026-07-28" && fresh.n === 2, JSON.stringify(fresh));

    await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: "2026-07-29", entries: [{ c: 1, n: 3 }] } });
    const ex = db.prepare("SELECT * FROM credits WHERE user_slug='cole' AND coaster_id=1").get();
    check("existing credit: earliest date wins", ex.first === "2023-05-05", "got " + ex.first);
    check("existing credit: laps accumulate", ex.n === 5, "got " + ex.n);

    await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: "2020-01-01", entries: [{ c: 1, n: 1 }] } });
    const earlier = db.prepare("SELECT * FROM credits WHERE user_slug='cole' AND coaster_id=1").get();
    check("an earlier date replaces the first-ridden date", earlier.first === "2020-01-01", "got " + earlier.first);

    await call(db, "POST", "/api/rides", { token: PW, body: { user: "max", d: "2026-07-28", entries: [{ c: 1, n: 1 }] } });
    const mx = db.prepare("SELECT * FROM credits WHERE user_slug='max' AND coaster_id=1").get();
    check("credit number (milestones) preserved", mx.num === 7, JSON.stringify(mx));
  }

  console.log("\nDELETE /api/ride");
  {
    const db = freshDb();
    const id = db.prepare("SELECT id FROM rides ORDER BY id LIMIT 1").get().id;
    let r = await call(db, "DELETE", "/api/ride", { body: { i: id } });
    check("no token -> 401", r.status === 401);
    check("...and the ride still exists", rows(db, "SELECT * FROM rides").length === 3);
    r = await call(db, "DELETE", "/api/ride", { token: PW, body: { i: id } });
    check("deletes the row and reports the new total", r.status === 200 && r.data.total === 2
      && rows(db, "SELECT * FROM rides").length === 2, JSON.stringify(r.data));
    r = await call(db, "DELETE", "/api/ride", { token: PW, body: { i: 99999 } });
    check("unknown ride id -> 404", r.status === 404);
  }

  console.log("\nRankings");
  {
    const db = freshDb();
    let r = await call(db, "GET", "/api/rankings/carter");
    check("empty ranking returns an empty order", r.status === 200 && Array.isArray(r.data.order) && r.data.order.length === 0);

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [3, 1, 2] } });
    check("PUT stores the order", r.status === 200 && r.data.count === 3, JSON.stringify(r.data));
    check("...with pos 1..n in list order",
      JSON.stringify(rows(db, "SELECT coaster_id,pos FROM rankings WHERE user_slug='carter' ORDER BY pos"))
        === JSON.stringify([{ coaster_id: 3, pos: 1 }, { coaster_id: 1, pos: 2 }, { coaster_id: 2, pos: 3 }]));

    r = await call(db, "GET", "/api/rankings/carter");
    check("GET reads it back in order", JSON.stringify(r.data.order) === JSON.stringify([3, 1, 2]));

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [2, 3] } });
    check("a shorter list replaces the old one entirely (no orphans)",
      rows(db, "SELECT * FROM rankings WHERE user_slug='carter'").length === 2
      && JSON.stringify((await call(db, "GET", "/api/rankings/carter")).data.order) === JSON.stringify([2, 3]));

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2, 1, 3, 2] } });
    check("duplicates are collapsed, first position wins",
      JSON.stringify((await call(db, "GET", "/api/rankings/carter")).data.order) === JSON.stringify([1, 2, 3]));

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 9999] } });
    check("unknown coaster id -> 400", r.status === 400);
    check("...and the previous order is untouched",
      JSON.stringify((await call(db, "GET", "/api/rankings/carter")).data.order) === JSON.stringify([1, 2, 3]));

    r = await call(db, "PUT", "/api/rankings/carter", { body: {} });
    check("missing order -> 400", r.status === 400);
    r = await call(db, "PUT", "/api/rankings/nobody", { body: { order: [1] } });
    check("unknown rider -> 404", r.status === 404);

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [] } });
    check("an empty order clears the ranking", r.status === 200
      && rows(db, "SELECT * FROM rankings WHERE user_slug='carter'").length === 0);

    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    await call(db, "PUT", "/api/rankings/cole", { body: { order: [3] } });
    check("riders' lists are independent",
      JSON.stringify((await call(db, "GET", "/api/rankings/carter")).data.order) === JSON.stringify([1, 2])
      && JSON.stringify((await call(db, "GET", "/api/rankings/cole")).data.order) === JSON.stringify([3]));
    check("writes are open while RANKINGS_NEED_TOKEN is false (no token needed)",
      (await call(db, "PUT", "/api/rankings/cole", { body: { order: [1] } })).status === 200);
  }

  console.log("\nRegression — endpoints the rest of the site depends on");
  {
    const db = freshDb();
    let r = await call(db, "GET", "/api/coasters");
    check("/api/coasters still returns the list", r.status === 200 && r.data.coasters.length === 3);
    check("...and coasters carry no loc field (location lives on the park)",
      r.data.coasters.every(c => !("loc" in c)));
    r = await call(db, "GET", "/api/parks");
    check("/api/parks still returns a name -> {lat,lon,region} map",
      r.status === 200 && r.data["Cedar Point"].region === "Ohio, US");
    r = await call(db, "GET", "/api/user/carter");
    check("/api/user/:slug unchanged for rides-mode", r.status === 200 && r.data.rides.length === 3);
    r = await call(db, "GET", "/api/user/cole");
    check("/api/user/:slug unchanged for credits-mode", r.status === 200 && r.data.credits.length === 1);
  }

  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
