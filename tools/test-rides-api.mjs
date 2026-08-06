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
// D1 rejects a statement with more bound parameters than SQLite's compiled-in
// limit ("too many SQL variables"). node:sqlite's own limit is far higher, so
// without this the shim happily runs queries the real database refuses — which
// is exactly how an unchunked `IN (?,?,…)` shipped and broke Save on a ranking
// past 100 rides. Enforce D1's ceiling so that class of bug fails here first.
const D1_MAX_VARS = 100;
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...a) {
    if (a.length > D1_MAX_VARS) {
      throw new Error("D1_ERROR: too many SQL variables (" + a.length + " > " + D1_MAX_VARS + ")");
    }
    this.args = a; return this;
  }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async first() { const r = this.db.prepare(this.sql).get(...this.args); return r === undefined ? null : r; }
  // Mirror D1's result shape, including meta.changes — addRides counts what was
  // actually written from it, and a shim that returned {} let a real bug
  // ("Added 0 coasters") pass unnoticed.
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
class FakeD1 {
  constructor(db) { this.db = db; }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; }
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
    CREATE TABLE rankings (user_slug TEXT NOT NULL, coaster_id INTEGER NOT NULL,
      pos INTEGER NOT NULL, PRIMARY KEY (user_slug, coaster_id));
    CREATE TABLE coaster_aliases (coaster_id INTEGER NOT NULL, former_name TEXT NOT NULL,
      note TEXT, added TEXT, UNIQUE(coaster_id, former_name));
    CREATE TABLE park_aliases (park TEXT NOT NULL, former_name TEXT NOT NULL PRIMARY KEY,
      note TEXT, added TEXT);
    CREATE TABLE activity (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT,
      kind TEXT NOT NULL, subject TEXT, n INTEGER, detail TEXT);
    INSERT INTO coasters (id,name,park,type) VALUES
      (1,'Steel Vengeance','Cedar Point','Steel'),
      (2,'Millennium Force','Cedar Point','Steel'),
      (3,'Blue Streak','Cedar Point','Wood');
    INSERT INTO parks (name,lat,lon,region) VALUES ('Cedar Point',41.483,-82.683,'Ohio, US');
    INSERT INTO users (slug,name,mode) VALUES ('carter','Carter','rides'),('cole','Cole','rides'),('max','Max','rides');
    -- Carter has a real dated log with a re-ride; Cole has one dated credit;
    -- Max's is undated, the shape a list ticked off from memory leaves behind.
    INSERT INTO rides (user_slug,coaster_id,d) VALUES
      ('carter',1,'2024-06-01'),('carter',1,'2024-06-01'),('carter',2,'2024-06-02'),
      ('cole',1,'2023-05-05'),('max',1,NULL);
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
    check("returns every ride with a row id", r.status === 200
      && r.data.rides.length === 3 && r.data.rides.every(x => Number.isInteger(x.i)), JSON.stringify(r.data));
    check("carries user name", r.data.user === "Carter");
    check("no mode field — there is only one shape now", r.data.mode === undefined);

    const c = await call(db, "GET", "/api/rides/cole");
    check("a dated credit is just a ride with a date",
      c.status === 200 && c.data.rides[0].c === 1 && c.data.rides[0].d === "2023-05-05"
      && Number.isInteger(c.data.rides[0].i), JSON.stringify(c.data));

    const m = await call(db, "GET", "/api/rides/max");
    check("an undated credit comes back with d null, not dropped",
      m.data.rides.length === 1 && m.data.rides[0].c === 1 && m.data.rides[0].d === null,
      JSON.stringify(m.data));

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

  console.log("\nPOST /api/rides — dated writes (a park day)");
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

  console.log("\nPOST /api/rides — undated writes (a list ticked off)");
  {
    const db = freshDb();
    let r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: null, entries: [{ c: 2, n: 1 }, { c: 3, n: 1 }] } });
    check("d:null is accepted, not treated as a bad date", r.status === 200, JSON.stringify(r.data));
    check("one undated row per coaster",
      rows(db, "SELECT * FROM rides WHERE user_slug='cole' AND d IS NULL").length === 2);
    check("reports what it wrote and the new credit count",
      r.data.added === 2 && r.data.credits === 3, JSON.stringify(r.data));
    check("echoes a null date", r.data.date === null);

    // "I have ridden this" is not a second ride. Ticking the same coaster
    // again must add nothing, whether it was already ticked or already logged.
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: null, entries: [{ c: 2, n: 1 }] } });
    check("re-ticking an undated coaster adds nothing",
      r.data.added === 0 && rows(db, "SELECT * FROM rides WHERE user_slug='cole'").length === 3, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "cole", d: null, entries: [{ c: 1, n: 1 }] } });
    check("ticking a coaster you already have DATED rides on adds nothing",
      r.data.added === 0 && rows(db, "SELECT * FROM rides WHERE user_slug='cole'").length === 3, JSON.stringify(r.data));

    // laps are unknown when undated, so a count must not multiply rows
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "max", d: null, entries: [{ c: 2, n: 9 }] } });
    check("a lap count on an undated entry still writes one row",
      r.data.added === 1 && rows(db, "SELECT * FROM rides WHERE user_slug='max' AND coaster_id=2").length === 1);

    // an undated rider can still log a real day afterwards
    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "max", d: "2026-07-28", entries: [{ c: 1, n: 2 }] } });
    check("a dated day on top of an undated credit adds real rides",
      r.data.added === 2 && rows(db, "SELECT * FROM rides WHERE user_slug='max'").length === 4, JSON.stringify(r.data));
    check("...and the credit count does not double-count that coaster", r.data.credits === 2, JSON.stringify(r.data));

    r = await call(db, "POST", "/api/rides", { token: PW, body: { user: "carter", d: "07/28/2026", entries: [{ c: 1, n: 1 }] } });
    check("a MALFORMED date is still rejected (null is not a free pass)", r.status === 400);
  }

  console.log("\nDELETE /api/ride");
  {
    const db = freshDb();
    const id = db.prepare("SELECT id FROM rides ORDER BY id LIMIT 1").get().id;
    let r = await call(db, "DELETE", "/api/ride", { body: { i: id } });
    check("no token -> 401", r.status === 401);
    check("...and the ride still exists", rows(db, "SELECT * FROM rides WHERE user_slug='carter'").length === 3);
    r = await call(db, "DELETE", "/api/ride", { token: PW, body: { i: id } });
    check("deletes the row and reports the new totals", r.status === 200
      && r.data.rides === 2 && r.data.credits === 2
      && rows(db, "SELECT * FROM rides WHERE user_slug='carter'").length === 2, JSON.stringify(r.data));
    r = await call(db, "DELETE", "/api/ride", { token: PW, body: { i: 99999 } });
    check("unknown ride id -> 404", r.status === 404);
  }

  console.log("\nDELETE /api/coaster/:id + usage");
  {
    const db = freshDb();
    // coaster 3 is ridden by nobody in the fixture; 1 is held by carter and cole
    let u = await call(db, "GET", "/api/coaster/3/usage");
    check("usage reports an unheld coaster as empty",
      u.status === 200 && u.data.riders.length === 0 && u.data.rides === 0, JSON.stringify(u.data));
    u = await call(db, "GET", "/api/coaster/1/usage");
    // carter 2 dated + cole 1 dated + max 1 UNDATED. An undated row is still a
    // rider holding the coaster, so it has to count here — miss that and the
    // delete guard would happily strip Max's credit.
    check("usage names every rider and their ride count, undated included",
      u.data.riders.length === 3 && u.data.rides === 4
      && u.data.riders.find(r => r.slug === "carter").rides === 2
      && u.data.riders.find(r => r.slug === "max").rides === 1, JSON.stringify(u.data));
    check("usage 404s for an unknown coaster", (await call(db, "GET", "/api/coaster/9999/usage")).status === 404);

    let r = await call(db, "DELETE", "/api/coaster/3");
    check("no token -> 401", r.status === 401);
    check("...and the coaster survives", rows(db, "SELECT * FROM coasters WHERE id=3").length === 1);

    r = await call(db, "DELETE", "/api/coaster/9999", { token: PW });
    check("unknown coaster -> 404", r.status === 404);

    // The important one: deleting must never quietly take a credit off someone.
    r = await call(db, "DELETE", "/api/coaster/1", { token: PW });
    check("a coaster riders still hold -> 409", r.status === 409, JSON.stringify(r.data));
    check("...and the 409 says who, so the UI can name them",
      r.data.riders.length === 3 && r.data.rides === 4 && /merge/i.test(r.data.error), JSON.stringify(r.data));
    check("...and nothing was deleted", rows(db, "SELECT * FROM coasters WHERE id=1").length === 1
      && rows(db, "SELECT * FROM rides WHERE coaster_id=1").length === 4);

    r = await call(db, "DELETE", "/api/coaster/3", { token: PW });
    check("an unheld coaster deletes", r.status === 200 && r.data.deleted === 3, JSON.stringify(r.data));
    check("...and is gone", rows(db, "SELECT * FROM coasters WHERE id=3").length === 0);
    check("...while every ride row is untouched", rows(db, "SELECT * FROM rides").length === 5);
  }

  console.log("\nAliases — former names");
  {
    const db = freshDb();
    // a rename banks the old name
    let r = await call(db, "PUT", "/api/coaster/1", { token: PW, body: { name: "Iron Vengeance" } });
    check("rename succeeds", r.status === 200);
    let al = rows(db, "SELECT * FROM coaster_aliases WHERE coaster_id=1");
    check("...and records the former name", al.length === 1 && al[0].former_name === "Steel Vengeance", JSON.stringify(al));

    // editing something else must not bank anything
    await call(db, "PUT", "/api/coaster/1", { token: PW, body: { h: 205 } });
    check("a non-name edit records nothing new", rows(db, "SELECT * FROM coaster_aliases WHERE coaster_id=1").length === 1);

    // renaming back must not alias a coaster to its own current name
    await call(db, "PUT", "/api/coaster/1", { token: PW, body: { name: "Steel Vengeance" } });
    check("renaming back does not alias a name to itself",
      rows(db, "SELECT * FROM coaster_aliases WHERE coaster_id=1 AND former_name='Steel Vengeance'").length === 0,
      JSON.stringify(rows(db, "SELECT * FROM coaster_aliases")));

    // a merge banks the disappearing name AND inherits its aliases
    const db2 = freshDb();
    db2.exec("INSERT INTO coaster_aliases (coaster_id,former_name) VALUES (3,'Old Blue')");
    await call(db2, "POST", "/api/merge", { token: PW, body: { from: 3, to: 2 } });
    const m = rows(db2, "SELECT former_name FROM coaster_aliases WHERE coaster_id=2 ORDER BY former_name").map(x => x.former_name);
    check("merge banks the removed name and carries its own aliases over",
      m.join("|") === "Blue Streak|Old Blue", JSON.stringify(m));
    check("...and leaves none behind on the deleted id",
      rows(db2, "SELECT * FROM coaster_aliases WHERE coaster_id=3").length === 0);

    // delete must not leave an alias pointing at nothing
    const db3 = freshDb();
    db3.exec("INSERT INTO coaster_aliases (coaster_id,former_name) VALUES (3,'Old Blue')");
    await call(db3, "DELETE", "/api/coaster/3", { token: PW });
    check("deleting a coaster removes its aliases",
      rows(db3, "SELECT * FROM coaster_aliases WHERE coaster_id=3").length === 0);

    // exposed on the coaster list, so the static fallback carries them
    const db4 = freshDb();
    db4.exec("INSERT INTO coaster_aliases (coaster_id,former_name) VALUES (1,'Mean Streak')");
    db4.exec("INSERT INTO park_aliases (park,former_name) VALUES ('Cedar Point','Cedar Pointe')");
    const list = await call(db4, "GET", "/api/coasters");
    check("/api/coasters carries aliases + parkAliases",
      list.data.aliases.length === 1 && list.data.aliases[0].n === "Mean Streak"
      && list.data.parkAliases.length === 1 && list.data.parkAliases[0].p === "Cedar Point",
      JSON.stringify({ a: list.data.aliases, p: list.data.parkAliases }));
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
    // Ungated on purpose (RANKINGS_NEED_TOKEN false) — asserted so that flipping
    // the flag fails here loudly instead of silently breaking the Save button.
    check("writes need no token while RANKINGS_NEED_TOKEN is false",
      (await call(db, "PUT", "/api/rankings/cole", { body: { order: [1] } })).status === 200);
    check("...and reading is open too",
      (await call(db, "GET", "/api/rankings/cole")).status === 200);
    check("...while /api/rides still DOES require a token",
      (await call(db, "POST", "/api/rides", { body: { user: "cole", d: null, entries: [{ c: 2, n: 1 }] } })).status === 401);
    check("...and so does /api/coaster",
      (await call(db, "POST", "/api/coaster", { body: { name: "X", park: "Cedar Point" } })).status === 401);
  }

  console.log("\nRanking bursts merge into one activity row");
  {
    const db = freshDb();
    const ranks = () => rows(db, "SELECT * FROM activity WHERE kind='ranking' AND actor='carter' ORDER BY id");

    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1] } });
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2, 3] } });
    let all = ranks();
    check("three saves in a row leave ONE row, not three", all.length === 1, JSON.stringify(all));
    let d = JSON.parse(all[0].detail);
    check("...with the added counts summed", d.added === 3, all[0].detail);
    check("...the newest total, not a sum of totals", d.total === 3, all[0].detail);
    check("...and an honest count of how many saves it took", d.saves === 3, all[0].detail);

    // Another rider's burst must not be swept into Carter's line.
    await call(db, "PUT", "/api/rankings/cole", { body: { order: [1, 2] } });
    check("a different rider gets their own row",
      rows(db, "SELECT * FROM activity WHERE kind='ranking'").length === 2);

    // Age the row past the merge window: the next save has to start a new line.
    db.prepare("UPDATE activity SET at = ? WHERE id = ?")
      .run(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), all[0].id);
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [3, 2, 1] } });
    all = ranks();
    check("a save more than an hour later starts a new row", all.length === 2, JSON.stringify(all));
    check("...and the new row counts one save", JSON.parse(all[1].detail).saves === 1, all[1].detail);

    // A backfilled row carries a bare date, which must not be parsed as recent.
    const db2 = freshDb();
    db2.prepare("INSERT INTO activity (at,actor,kind,subject,n,detail) VALUES (?,?,?,?,?,?)")
      .run("2026-01-01", "carter", "ranking", null, 1, JSON.stringify({ added: 1, total: 1 }));
    await call(db2, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    check("a dateless legacy row is never merged into",
      rows(db2, "SELECT * FROM activity WHERE kind='ranking'").length === 2);

    // A save that changes nothing still writes nothing, merge window or not.
    const before = ranks().length;
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [3, 2, 1] } });
    check("re-saving an unchanged order still records nothing", ranks().length === before);
  }

  // A ranking is one row per credit, so any rider past ~100 blows the bound-
  // parameter ceiling. This failed in production with "too many SQL variables"
  // once Carter's list crossed 100 — the save was rejected outright.
  console.log("\nLong lists (bound-parameter ceiling)");
  {
    const db = freshDb();
    const N = 260;
    for (let i = 4; i <= N; i++) {
      db.prepare("INSERT INTO coasters (id,name,park,type) VALUES (?,?,?,?)")
        .run(i, "Coaster " + i, "Cedar Point", "Steel");
    }
    const order = Array.from({ length: N }, (_, i) => i + 1);

    let r = await call(db, "PUT", "/api/rankings/carter", { body: { order } });
    check(`a ranking of ${N} saves`, r.status === 200 && r.data.count === N, JSON.stringify(r.data));
    check("...and reads back in the same order",
      JSON.stringify((await call(db, "GET", "/api/rankings/carter")).data.order) === JSON.stringify(order));

    r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [...order.slice(0, 150), 99999] } });
    check("one unknown id in a long list still rejects the whole write", r.status === 400);
    check("...leaving the stored ranking intact",
      rows(db, "SELECT * FROM rankings WHERE user_slug='carter'").length === N);

    // Same ceiling on the import path: a pasted list is one entry per coaster.
    const entries = order.map((c) => ({ c, n: 1 }));
    r = await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "cole", d: null, entries } });
    check(`an undated import of ${N} coasters saves`, r.status === 200, JSON.stringify(r.data));
    check("...and gives the rider that many credits",
      rows(db, "SELECT COUNT(DISTINCT coaster_id) AS c FROM rides WHERE user_slug='cole'")[0].c === N);
  }

  // The feed is what five people sharing one password use to see each other's
  // work, so the thing that matters is that it says the right THING — "ranked 20
  // new coasters", not "saved 562". recordActivity swallows its own errors on
  // purpose, which means a broken feed cannot fail a write; these assertions are
  // the only thing that would notice.
  console.log("\nActivity feed");
  {
    const db = freshDb();
    const acts = () => rows(db, "SELECT * FROM activity ORDER BY id");
    const last = () => { const a = acts(); return a[a.length - 1]; };

    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "cole", d: "2026-08-01", entries: [{ c: 2, n: 3 }] } });
    let e = last();
    check("a logged day records the rider who logged it",
      e && e.kind === "rides" && e.actor === "cole" && e.n === 3, JSON.stringify(e));
    check("...naming the park, so the feed reads 'at Cedar Point'",
      e.subject === "Cedar Point", JSON.stringify(e));
    check("...and how many were new credits, not just laps",
      JSON.parse(e.detail).newCredits === 1, e.detail);

    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "max", d: null, entries: [{ c: 2, n: 1 }, { c: 3, n: 1 }] } });
    e = last();
    check("an undated list-tick records as credits, not rides",
      e.kind === "credits" && e.actor === "max" && e.n === 2, JSON.stringify(e));

    // The whole point of diffing against the previous order.
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2, 3] } });
    e = last();
    check("a first ranking records 3 newly ranked",
      e.kind === "ranking" && e.actor === "carter" && JSON.parse(e.detail).added === 3, JSON.stringify(e));

    const nBefore = acts().length;
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2, 3] } });
    check("re-saving the same order records nothing", acts().length === nBefore);

    // Within the merge window a reorder folds into the burst it belongs to — the
    // flag survives, the counts carry over. It only stands as its own row once
    // the previous one has aged out, which is asserted below.
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [3, 1, 2] } });
    e = last();
    check("a reorder inside the window merges into the burst, keeping the flag",
      JSON.parse(e.detail).reordered === true && JSON.parse(e.detail).added === 3, e.detail);

    await call(db, "PUT", "/api/rankings/carter", { body: { order: [3, 1] } });
    check("a drop is recorded as removed", JSON.parse(last().detail).removed === 1, last().detail);

    // Age the burst out, then reorder alone: on its own it is a reorder and
    // nothing else, which is what the feed's "reordered their rankings" needs.
    db.prepare("UPDATE activity SET at = ? WHERE id = ?")
      .run(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), last().id);
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 3] } });
    e = last();
    check("a pure reorder on its own is a reorder, not new coasters",
      JSON.parse(e.detail).reordered === true && JSON.parse(e.detail).added === 0
      && JSON.parse(e.detail).saves === 1, e.detail);

    // Database edits carry no rider — they must stay anonymous rather than
    // borrowing whichever name happens to be selected in the UI.
    await call(db, "POST", "/api/coaster", { token: PW, body: { name: "Zippin Pippin", park: "Bay Beach" } });
    e = last();
    check("adding a coaster records it with NO actor",
      e.kind === "coaster_added" && e.actor === null && e.subject === "Zippin Pippin", JSON.stringify(e));

    await call(db, "PUT", "/api/coaster/3", { token: PW, body: { name: "Blue Streak (Wood)" } });
    e = last();
    check("a rename records both names",
      e.kind === "coaster_renamed" && e.subject === "Blue Streak (Wood)"
      && JSON.parse(e.detail).from === "Blue Streak", JSON.stringify(e));
    // /changes prints the park after a rename or a merge; two names and no place
    // is a riddle when the same retheme lands at six parks.
    check("...and the park it happened at",
      JSON.parse(e.detail).park === "Cedar Point", e.detail);

    await call(db, "PUT", "/api/coaster/3", { token: PW, body: { name: "Blue Streak", park: "Kings Island" } });
    check("a rename that also moves parks reports the NEW park",
      JSON.parse(last().detail).park === "Kings Island", last().detail);
    await call(db, "PUT", "/api/coaster/3", { token: PW, body: { name: "Blue Streak (Wood)", park: "Cedar Point" } });

    await call(db, "PUT", "/api/coaster/3", { token: PW, body: { h: 78 } });
    e = last();
    check("a spec-only edit is an edit, and still names the coaster",
      e.kind === "coaster_edited" && e.subject === "Blue Streak (Wood)", JSON.stringify(e));

    await call(db, "POST", "/api/merge", { token: PW, body: { from: 2, to: 1 } });
    e = last();
    check("a merge records both sides",
      e.kind === "coaster_merged" && e.subject === "Steel Vengeance"
      && JSON.parse(e.detail).fromName === "Millennium Force", JSON.stringify(e));
    check("...and the surviving coaster's park",
      JSON.parse(e.detail).park === "Cedar Point", e.detail);

    const r = await call(db, "GET", "/api/activity");
    check("GET /api/activity is public — no token needed", r.status === 200);
    check("...newest first", r.data.events[0].kind === "coaster_merged", JSON.stringify(r.data.events[0]));
    const cole = r.data.events.find(x => x.actor === "cole");
    check("...and resolves the slug to a display name", cole && cole.actorName === "Cole");
    check("...while an actorless event reports no name",
      r.data.events.find(x => x.kind === "coaster_added").actorName === null);

    check("limit is clamped, so ?limit=99999 can't dump the table",
      (await call(db, "GET", "/api/activity?limit=99999")).status === 200);
  }

  console.log("\nRiders — GET /api/users + POST /api/user");
  {
    const db = freshDb();
    let r = await call(db, "GET", "/api/users");
    check("the rider list is public and name-sorted",
      r.status === 200 && r.data.users.map(u => u.slug).join(",") === "carter,cole,max");

    check("adding a rider needs the password",
      (await call(db, "POST", "/api/user", { body: { name: "Jamie" } })).status === 401);

    r = await call(db, "POST", "/api/user", { token: PW, body: { name: "Jamie" } });
    check("a new rider is created, slug derived from the name",
      r.status === 200 && r.data.slug === "jamie" && r.data.name === "Jamie", JSON.stringify(r.data));
    check("...and lands in the users table with mode 'rides'",
      rows(db, "SELECT * FROM users WHERE slug='jamie'")[0].mode === "rides");
    check("...and shows up in the list straight away",
      (await call(db, "GET", "/api/users")).data.users.some(u => u.slug === "jamie"));
    check("...with pages that work while empty — /api/user/:slug is 200, not 404",
      (await call(db, "GET", "/api/user/jamie")).status === 200);
    check("...and an empty ride log rather than a missing one",
      (await call(db, "GET", "/api/rides/jamie")).data.rides.length === 0);
    check("...recorded in the activity feed",
      rows(db, "SELECT * FROM activity WHERE kind='user_added'").length === 1);

    r = await call(db, "POST", "/api/user", { token: PW, body: { name: "Jamie" } });
    check("the same slug twice is refused, not silently merged", r.status === 409);
    check("...and no second row was written",
      rows(db, "SELECT * FROM users WHERE slug='jamie'").length === 1);

    r = await call(db, "POST", "/api/user", { token: PW, body: { name: "  Ana María  " } });
    check("accents and spaces fold into a URL-safe slug",
      r.status === 200 && r.data.slug === "ana-maria" && r.data.name === "Ana María", JSON.stringify(r.data));

    check("a nameless rider is a 400",
      (await call(db, "POST", "/api/user", { token: PW, body: { name: "   " } })).status === 400);
    check("a name with nothing slug-able in it is a 400",
      (await call(db, "POST", "/api/user", { token: PW, body: { name: "!!!" } })).status === 400);
    check("a one-character name is a 400 (the slug is a URL)",
      (await call(db, "POST", "/api/user", { token: PW, body: { name: "J" } })).status === 400);
    check("a page name can't be taken as a rider slug",
      (await call(db, "POST", "/api/user", { token: PW, body: { name: "Stats" } })).status === 400);
    check("...and none of those wrote a row",
      rows(db, "SELECT * FROM users").length === 5);
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
    check("/api/user/:slug returns rides", r.status === 200 && r.data.rides.length === 3);
    r = await call(db, "GET", "/api/user/cole");
    check("/api/user/:slug returns rides for everyone — no credits key",
      r.status === 200 && r.data.rides.length === 1 && r.data.credits === undefined, JSON.stringify(r.data));
  }

  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
