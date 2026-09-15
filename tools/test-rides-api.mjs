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
    -- Accounts. Kept in step with migrations/003-accounts.sql by hand, like every
    -- other table here; the migration is the source of truth for production.
    CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL,
      pw TEXT NOT NULL, slug TEXT, is_admin INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL, seen TEXT);
    CREATE UNIQUE INDEX accounts_email ON accounts(lower(email));
    CREATE UNIQUE INDEX accounts_slug ON accounts(slug) WHERE slug IS NOT NULL;
    CREATE TABLE sessions (token TEXT PRIMARY KEY, account INTEGER NOT NULL,
      created TEXT NOT NULL, expires TEXT NOT NULL);
    CREATE TABLE invites (code TEXT PRIMARY KEY, slug TEXT NOT NULL, created TEXT NOT NULL, used TEXT);
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

async function call(db, method, path, { body, token, cookie } = {}) {
  const headers = {};
  if (token) headers["x-admin-token"] = token;
  if (cookie) headers["cookie"] = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = new Request("https://coasterhub.org" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW };
  const res = await worker.fetch(req, env, ctx);
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  // The name=value pair only, which is what a browser would send back up.
  const set = res.headers.get("set-cookie");
  return { status: res.status, data, setCookie: set, cookie: set ? set.split(";")[0] : null };
}

// Sign up and return the cookie a browser would then be holding.
async function signedUp(db, email, name, password = "riding-things") {
  const r = await call(db, "POST", "/api/auth/signup", { body: { email, name, password } });
  if (r.status !== 200) throw new Error("signup failed: " + JSON.stringify(r.data));
  return r.cookie;
}

// The same request with NO ADMIN_PASSWORD configured, which is the end state
// Carter is heading for: the secret unset, admin accounts the only way in.
async function callNoPassword(db, method, path, { body, cookie } = {}) {
  const headers = {};
  if (cookie) headers["cookie"] = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = new Request("https://coasterhub.org" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await worker.fetch(req, { DB: new FakeD1(db) }, ctx);
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

  console.log("\nAccounts — the Workers PBKDF2 ceiling");
  {
    // node:sqlite runs this suite on Node's WebCrypto, which accepts ANY
    // iteration count. The Workers runtime refuses anything over 100000
    // ("iteration counts above 100000 are not supported") — so the first real
    // sign-up on production failed on a number every local test had passed.
    // Reading the constant out of the source is the only way this suite can see
    // a limit its own crypto does not enforce.
    const src = await readFile(join(ROOT, "worker.js"), "utf8");
    const iters = Number((src.match(/const PBKDF2_ITERS = (?:PBKDF2_MAX_ITERS|(\d+))/) || [])[1]
      || (src.match(/const PBKDF2_MAX_ITERS = (\d+)/) || [])[1]);
    check("the iteration count is within what Workers will run",
      Number.isInteger(iters) && iters > 0 && iters <= 100000, "PBKDF2_ITERS = " + iters);

    // Every hash the code can produce has to be verifiable by the same code.
    const dummy = (src.match(/const DUMMY_HASH = "([^"]+)"/) || [])[1] || "";
    const dummyIters = Number(dummy.split("$")[2]);
    check("...and so is the dummy hash the login route verifies against",
      dummyIters > 0 && dummyIters <= 100000, "DUMMY_HASH iters = " + dummyIters);

    // An unknown email must reach the dummy-hash comparison and come back 401,
    // not 500 — which is what a dummy hash above the ceiling would cause.
    const db = freshDb();
    const r = await call(db, "POST", "/api/auth/login",
      { body: { email: "nobody@example.com", password: "whatever-it-is" } });
    check("signing in with an unknown email is a clean 401", r.status === 401, JSON.stringify(r.data));
  }

  console.log("\nAccounts — signing up");
  {
    const db = freshDb();
    let r = await call(db, "POST", "/api/auth/signup",
      { body: { email: "Nia@Example.COM ", name: "Nia", password: "riding-things" } });
    check("signup creates an account and returns the new rider",
      r.status === 200 && r.data.slug === "nia", JSON.stringify(r.data));
    check("...and sets an HttpOnly Secure SameSite cookie",
      /^ch_sess=[0-9a-f]{64};/.test(r.setCookie || "") && /HttpOnly/.test(r.setCookie)
      && /Secure/.test(r.setCookie) && /SameSite=Lax/.test(r.setCookie), r.setCookie);
    check("...and the rider row exists, with no rides",
      rows(db, "SELECT * FROM users WHERE slug = 'nia'").length === 1
      && rows(db, "SELECT * FROM rides WHERE user_slug = 'nia'").length === 0);
    // The shape, not the iteration count — that is pinned once, against the
    // runtime ceiling, in the section above.
    check("...and the password is never stored in the clear",
      /^pbkdf2\$sha256\$\d+\$[^$]+\$[^$]+$/.test(rows(db, "SELECT pw FROM accounts")[0].pw),
      rows(db, "SELECT pw FROM accounts")[0].pw);
    check("...and the email is normalised to lowercase, trimmed",
      rows(db, "SELECT email FROM accounts")[0].email === "nia@example.com");

    const me = await call(db, "GET", "/api/auth/me", { cookie: r.cookie });
    check("/api/auth/me names the signed-in rider",
      me.status === 200 && me.data.account.slug === "nia" && me.data.account.name === "Nia"
      && me.data.account.admin === false, JSON.stringify(me.data));
    const anon = await call(db, "GET", "/api/auth/me");
    check("/api/auth/me is a 200 with a null account when signed out",
      anon.status === 200 && anon.data.account === null, JSON.stringify(anon.data));

    r = await call(db, "POST", "/api/auth/signup",
      { body: { email: "NIA@example.com", name: "Nia Again", password: "riding-things" } });
    check("the same email cannot sign up twice, whatever the case", r.status === 409);
    check("...and the rejected signup left no half-made rider behind",
      rows(db, "SELECT * FROM users WHERE slug = 'nia-again'").length === 0);

    r = await call(db, "POST", "/api/auth/signup", { body: { email: "x@y.z", name: "Short", password: "abc" } });
    check("a password under 8 characters is refused", r.status === 400);
    r = await call(db, "POST", "/api/auth/signup", { body: { email: "not-an-email", name: "Bad", password: "riding-things" } });
    check("a malformed email is refused", r.status === 400);
    r = await call(db, "POST", "/api/auth/signup", { body: { email: "s@t.u", name: "Stats", password: "riding-things" } });
    check("a rider name that collides with a page name is refused", r.status === 400, JSON.stringify(r.data));
  }

  console.log("\nAccounts — signing in and out");
  {
    const db = freshDb();
    await signedUp(db, "nia@example.com", "Nia");

    let r = await call(db, "POST", "/api/auth/login", { body: { email: "nia@example.com", password: "wrong" } });
    check("the wrong password is a 401", r.status === 401);
    check("...and says nothing about which half was wrong", r.data.error === "wrong email or password");
    r = await call(db, "POST", "/api/auth/login", { body: { email: "ghost@example.com", password: "riding-things" } });
    check("an unknown email gets the identical answer", r.status === 401
      && r.data.error === "wrong email or password");

    r = await call(db, "POST", "/api/auth/login", { body: { email: "NIA@Example.com", password: "riding-things" } });
    check("the right password signs in, case-insensitively on the email", r.status === 200);
    const cookie = r.cookie;
    check("...and records the sign-in", rows(db, "SELECT seen FROM accounts")[0].seen !== null);
    check("...and the session row holds a hash, not the cookie value",
      rows(db, "SELECT token FROM sessions").every(x => !cookie.includes(x.token)));

    // Two sessions are live here: the one signup opened and the one login just
    // did. Signing out must end exactly one of them — logging out on a phone
    // should not sign you out of a laptop.
    const before = rows(db, "SELECT * FROM sessions").length;
    const out = await call(db, "POST", "/api/auth/logout", { cookie });
    check("logout clears the cookie", /Max-Age=0/.test(out.setCookie || ""), out.setCookie);
    check("...and drops that session's row, leaving other devices signed in",
      before === 2 && rows(db, "SELECT * FROM sessions").length === 1);
    const after = await call(db, "GET", "/api/auth/me", { cookie });
    check("...so the old cookie no longer signs anyone in", after.data.account === null);

    const forged = await call(db, "GET", "/api/auth/me", { cookie: "ch_sess=" + "a".repeat(64) });
    check("a made-up cookie is nobody", forged.data.account === null);
  }

  console.log("\nAccounts — you may only write to your own count");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    const ravi = await signedUp(db, "ravi@example.com", "Ravi");
    const day = { d: "2026-01-02", entries: [{ c: 1, n: 2 }] };

    let r = await call(db, "POST", "/api/rides", { body: { user: "nia", ...day }, cookie: nia });
    check("a signed-in rider can log their own day, with no admin password",
      r.status === 200 && rows(db, "SELECT * FROM rides WHERE user_slug = 'nia'").length === 2,
      JSON.stringify(r.data));

    r = await call(db, "POST", "/api/rides", { body: { user: "ravi", ...day }, cookie: nia });
    check("...but not someone else's", r.status === 401);
    check("...and nothing was written", rows(db, "SELECT * FROM rides WHERE user_slug = 'ravi'").length === 0);

    r = await call(db, "POST", "/api/rides", { body: { user: "carter", ...day }, cookie: nia });
    check("...not even into a rider who predates accounts", r.status === 401);

    r = await call(db, "POST", "/api/rides", { body: { user: "nia", ...day } });
    check("signed out, a ride write is still a 401", r.status === 401);
    r = await call(db, "POST", "/api/rides", { body: { user: "carter", ...day }, token: PW });
    check("the shared admin password still logs for anyone (unchanged)",
      r.status === 200, JSON.stringify(r.data));

    // Deleting one ride: the owner is on the row, not in the request.
    const mine = rows(db, "SELECT id FROM rides WHERE user_slug = 'nia'")[0].id;
    const theirs = rows(db, "SELECT id FROM rides WHERE user_slug = 'carter'")[0].id;
    r = await call(db, "DELETE", "/api/ride", { body: { i: theirs }, cookie: nia });
    check("a rider cannot delete a ride out of someone else's log", r.status === 401
      && rows(db, "SELECT * FROM rides WHERE id = " + theirs).length === 1);
    r = await call(db, "DELETE", "/api/ride", { body: { i: mine }, cookie: nia });
    check("...but can delete their own", r.status === 200
      && rows(db, "SELECT * FROM rides WHERE id = " + mine).length === 0);

    r = await call(db, "POST", "/api/credit", { body: { user: "ravi", coaster_id: 3 }, cookie: nia });
    check("credits follow the same rule", r.status === 401);
    r = await call(db, "POST", "/api/credit", { body: { user: "nia", coaster_id: 3 }, cookie: nia });
    check("...for you as well as against you", r.status === 200);
    r = await call(db, "DELETE", "/api/credit", { body: { user: "ravi", coaster_id: 1 }, cookie: nia });
    check("removing a credit from another rider is refused", r.status === 401);

    r = await call(db, "POST", "/api/coaster", { body: { name: "New One", park: "Cedar Point" }, cookie: nia });
    check("an account does NOT open the shared coaster database", r.status === 401, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/user", { body: { name: "Someone" }, cookie: nia });
    check("...nor adding riders by hand", r.status === 401);
  }

  console.log("\nAdmin accounts open the shared database, so the password is optional");
  {
    const db = freshDb();
    const rider = await signedUp(db, "rider@example.com", "Rider");
    const boss = await signedUp(db, "boss@example.com", "Boss");
    db.exec("UPDATE accounts SET is_admin = 1 WHERE slug = 'boss'");

    // The whole point: everything /add, /edit and /import write, with no
    // password anywhere.
    let r = await call(db, "POST", "/api/coaster",
      { body: { name: "Iron Gwazi", park: "Busch Gardens Tampa" }, cookie: boss });
    check("an admin account can add a coaster", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "PUT", "/api/park",
      { body: { name: "Busch Gardens Tampa", lat: 28.03, lon: -82.42, region: "Florida, US" }, cookie: boss });
    check("...and place a park", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/user", { body: { name: "Newcomer" }, cookie: boss });
    check("...and add a rider", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/invite", { body: { slug: "cole" }, cookie: boss });
    check("...and mint an invite, which is how the password stops being needed",
      r.status === 200 && /\/account\?claim=/.test(r.data.url || ""), JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/login", { cookie: boss });
    check("...and the gate check the pages use says yes, via the account",
      r.status === 200 && r.data.via === "account", JSON.stringify(r.data));

    // An ordinary rider is still nowhere near any of it.
    r = await call(db, "POST", "/api/coaster",
      { body: { name: "Sneaky", park: "Cedar Point" }, cookie: rider });
    check("a plain rider account still cannot add a coaster", r.status === 401);
    r = await call(db, "POST", "/api/user", { body: { name: "Nobody" }, cookie: rider });
    check("...nor add a rider", r.status === 401);
    r = await call(db, "POST", "/api/merge", { body: { from: 1, to: 2 }, cookie: rider });
    check("...nor merge coasters", r.status === 401);
    r = await call(db, "POST", "/api/admin/login", { cookie: rider });
    check("...and the gate check says no", r.status === 401);
    r = await call(db, "POST", "/api/coaster", { body: { name: "Sneaky", park: "Cedar Point" } });
    check("signed out, still no", r.status === 401);

    // The password has not stopped working; it is just no longer the only key.
    r = await call(db, "POST", "/api/coaster",
      { body: { name: "Velocicoaster", park: "Islands of Adventure" }, token: PW });
    check("the shared password still works as break-glass", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/login", { token: PW });
    check("...and reports itself as the password, not an account",
      r.status === 200 && r.data.via === "password", JSON.stringify(r.data));

    // And with no ADMIN_PASSWORD configured at all, accounts are the only way in.
    const noPw = await callNoPassword(db, "POST", "/api/coaster",
      { body: { name: "No Password Here", park: "Cedar Point" }, cookie: boss });
    check("an admin account works even with ADMIN_PASSWORD unset entirely",
      noPw.status === 200, JSON.stringify(noPw.data));
  }

  console.log("\nAccounts — rankings close as riders claim them");
  {
    const db = freshDb();
    let r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    check("an unclaimed rider's rankings stay open, as before accounts", r.status === 200,
      JSON.stringify(r.data));

    const nia = await signedUp(db, "nia@example.com", "Nia");
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [1] } });
    check("a claimed rider's rankings are closed to the public", r.status === 401);
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [1] }, cookie: nia });
    check("...and open to its owner", r.status === 200, JSON.stringify(r.data));

    // The one write on the site with NO admin override. A ranking is an
    // opinion, not data that can be wrong, so there is no repair an admin needs
    // to make to it — and being able to reorder someone's favourites is exactly
    // the power nobody should hold. Carter's call, 2026-09-15.
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [2] }, token: PW });
    check("the shared admin password does NOT open someone else's ranking", r.status === 401,
      JSON.stringify(r.data));

    const boss = await signedUp(db, "boss@example.com", "Boss");
    db.exec("UPDATE accounts SET is_admin = 1 WHERE slug = 'boss'");
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [3] }, cookie: boss });
    check("...nor does an admin account", r.status === 401, JSON.stringify(r.data));
    check("...and the owner's order is exactly as they left it",
      rows(db, "SELECT coaster_id FROM rankings WHERE user_slug='nia' ORDER BY pos")
        .map(x => x.coaster_id).join(",") === "1");

    r = await call(db, "GET", "/api/rankings/nia");
    check("a claimed ranking says so, so the page can go read-only",
      r.status === 200 && r.data.claimed === true, JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rankings/cole");
    check("...and an unclaimed one says that too", r.status === 200 && r.data.claimed === false,
      JSON.stringify(r.data));
  }

  console.log("\nAccounts — claiming a rider who predates accounts");
  {
    const db = freshDb();
    let r = await call(db, "POST", "/api/admin/invite", { body: { slug: "carter" } });
    check("only an admin can mint an invite", r.status === 401);
    r = await call(db, "POST", "/api/admin/invite", { body: { slug: "nobody" }, token: PW });
    check("an invite for a rider who does not exist is a 404", r.status === 404);
    r = await call(db, "POST", "/api/admin/invite", { body: { slug: "carter" }, token: PW });
    check("an invite hands back a claim URL", r.status === 200
      && /^https:\/\/coasterhub\.org\/account\?claim=[0-9a-f]{64}$/.test(r.data.url || ""), r.data.url);
    const code = r.data.url.split("=")[1];

    const look = await call(db, "GET", "/api/auth/invite?code=" + code);
    check("the claim page can look the invite up by code",
      look.status === 200 && look.data.slug === "carter" && look.data.name === "Carter");
    check("a bogus code 404s", (await call(db, "GET", "/api/auth/invite?code=nope")).status === 404);

    r = await call(db, "POST", "/api/auth/claim",
      { body: { code, email: "carter@example.com", password: "riding-things" } });
    check("claiming binds a new login to the EXISTING rider", r.status === 200 && r.data.slug === "carter");
    check("...and Carter's rides are untouched",
      rows(db, "SELECT * FROM rides WHERE user_slug = 'carter'").length === 3);
    check("...and no second rider was created", rows(db, "SELECT * FROM users").length === 3);

    const carter = r.cookie;
    r = await call(db, "POST", "/api/rides",
      { body: { user: "carter", d: "2026-02-02", entries: [{ c: 2, n: 1 }] }, cookie: carter });
    check("...so he can now log his own day without the shared password", r.status === 200);

    r = await call(db, "POST", "/api/auth/claim",
      { body: { code, email: "someone-else@example.com", password: "riding-things" } });
    check("an invite is single use", r.status === 410, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/invite", { body: { slug: "carter" }, token: PW });
    check("and a claimed rider cannot be re-invited", r.status === 409);
  }

  console.log("\nAccounts — changing your password");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    let r = await call(db, "POST", "/api/auth/password", { body: { current: "riding-things", password: "longer-one" } });
    check("signed out, you cannot change a password", r.status === 401);
    r = await call(db, "POST", "/api/auth/password", { body: { current: "wrong", password: "longer-one" }, cookie: nia });
    check("the current password is required", r.status === 401);
    r = await call(db, "POST", "/api/auth/password", { body: { current: "riding-things", password: "short" }, cookie: nia });
    check("the new one still has to be long enough", r.status === 400);
    r = await call(db, "POST", "/api/auth/password", { body: { current: "riding-things", password: "longer-one" }, cookie: nia });
    check("with the current password it changes", r.status === 200);
    check("...and every other session is dropped", rows(db, "SELECT * FROM sessions").length === 1);
    check("...leaving the old cookie dead",
      (await call(db, "GET", "/api/auth/me", { cookie: nia })).data.account === null);
    check("...and the new one working",
      (await call(db, "GET", "/api/auth/me", { cookie: r.cookie })).data.account.slug === "nia");
    check("...and the old password no longer signs in",
      (await call(db, "POST", "/api/auth/login", { body: { email: "nia@example.com", password: "riding-things" } })).status === 401);
  }

  console.log("\nAccounts — a database where the migration has not run yet");
  {
    // The deploy order is: push (Worker goes live) then run the migration by
    // hand. Everything has to keep working in the gap, or a rankings save 500s
    // on "no such table: accounts" for everyone.
    const db = freshDb();
    db.exec("DROP TABLE sessions; DROP TABLE invites; DROP TABLE accounts;");

    let r = await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    check("rankings still save", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/rides",
      { body: { user: "carter", d: "2026-03-03", entries: [{ c: 1, n: 1 }] }, token: PW });
    check("the shared password still logs rides", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/rides",
      { body: { user: "carter", d: "2026-03-03", entries: [{ c: 1, n: 1 }] } });
    check("...and an unauthorized one is still refused, not a 500", r.status === 401);
    r = await call(db, "GET", "/api/auth/me");
    check("/api/auth/me answers 'nobody', so every page still renders",
      r.status === 200 && r.data.account === null, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/auth/login", { body: { email: "a@b.c", password: "whatever" } });
    check("signing in says the feature is not deployed, rather than 500ing", r.status === 503);
    r = await call(db, "POST", "/api/admin/invite", { body: { slug: "carter" }, token: PW });
    check("minting an invite names the migration to run", r.status === 503
      && /003-accounts/.test(r.data.error || ""), JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rides/carter");
    check("and ordinary reads are untouched", r.status === 200);
  }

  console.log("\nRanking a coaster makes it a credit");
  {
    const db = freshDb();
    // Cole starts with one ride (coaster 1) and no rankings.
    let r = await call(db, "PUT", "/api/rankings/cole", { body: { order: [1, 2, 3] } });
    check("ranking coasters they have never logged gives them the credits",
      r.status === 200 && r.data.credited === 2, JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rides/cole");
    check("...so the count moves from 1 to 3", r.status === 200
      && new Set(r.data.rides.map(x => x.c)).size === 3, JSON.stringify(r.data));
    check("...the new rows are undated, like a list ticked off",
      rows(db, "SELECT * FROM rides WHERE user_slug='cole' AND coaster_id IN (2,3)")
        .every(x => x.d === null));
    check("...and the one they already had was not duplicated",
      rows(db, "SELECT * FROM rides WHERE user_slug='cole' AND coaster_id=1").length === 1);

    r = await call(db, "PUT", "/api/rankings/cole", { body: { order: [3, 2, 1] } });
    check("re-saving the same coasters in a new order credits nothing more",
      r.status === 200 && r.data.credited === 0, JSON.stringify(r.data));
    check("...and the ride rows are unchanged",
      rows(db, "SELECT * FROM rides WHERE user_slug='cole'").length === 3);

    // The asymmetry: ranking adds, un-ranking never takes away.
    r = await call(db, "PUT", "/api/rankings/cole", { body: { order: [1] } });
    check("dropping a coaster off the ranking keeps the credit",
      r.status === 200 && rows(db, "SELECT * FROM rides WHERE user_slug='cole'").length === 3,
      JSON.stringify(r.data));

    // A rider's real dated history must not be touched by any of this.
    const carterBefore = rows(db, "SELECT * FROM rides WHERE user_slug='carter'").length;
    await call(db, "PUT", "/api/rankings/carter", { body: { order: [1, 2] } });
    check("a rider who already rode everything they ranked gains nothing",
      rows(db, "SELECT * FROM rides WHERE user_slug='carter'").length === carterBefore);
    r = await call(db, "GET", "/api/rides/carter");
    check("...and their dated rides keep their dates",
      r.data.rides.filter(x => x.d === "2024-06-01").length === 2, JSON.stringify(r.data));

    // Clearing a ranking entirely is not a way to lose a count.
    r = await call(db, "PUT", "/api/rankings/cole", { body: { order: [] } });
    check("clearing the ranking credits nothing and removes nothing",
      r.status === 200 && r.data.credited === 0
      && rows(db, "SELECT * FROM rides WHERE user_slug='cole'").length === 3, JSON.stringify(r.data));

    // The feed should say the count moved, not just that a list was reordered —
    // but as ONE entry, since the rider did one thing.
    const feed = rows(db, "SELECT kind, actor, n, detail FROM activity WHERE actor='cole' ORDER BY id");
    const ranking = feed.filter(x => x.kind === "ranking");
    check("the credits gained are recorded on the ranking entry",
      ranking.length === 1 && JSON.parse(ranking[0].detail).credited === 2, JSON.stringify(feed));
    check("...and not as a second entry claiming a separate event",
      feed.filter(x => x.kind === "credits").length === 0, JSON.stringify(feed));
  }

  console.log("\nRanking credits respect who may write");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    // An unclaimed rider's rankings are still open (see above), and that must
    // not become a way to write rides into their count from outside.
    let r = await call(db, "PUT", "/api/rankings/cole", { body: { order: [2] } });
    check("an unclaimed rider's open rankings still credit them", r.status === 200
      && r.data.credited === 1, JSON.stringify(r.data));
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [1, 2] } });
    check("a claimed rider's rankings cannot be written by a stranger", r.status === 401);
    check("...so no credits appeared in their count",
      rows(db, "SELECT * FROM rides WHERE user_slug='nia'").length === 0);
    r = await call(db, "PUT", "/api/rankings/nia", { body: { order: [1, 2] }, cookie: nia });
    check("...but their own save credits them", r.status === 200 && r.data.credited === 2,
      JSON.stringify(r.data));
  }

  console.log("\nProfiles — renaming moves everything and leaves nothing behind");
  {
    const db = freshDb();
    const carter = await signedUp(db, "c@example.com", "Tempname");
    await call(db, "POST", "/api/rides",
      { body: { user: "tempname", d: "2026-05-05", entries: [{ c: 1, n: 2 }] }, cookie: carter });
    await call(db, "PUT", "/api/rankings/tempname", { body: { order: [1] }, cookie: carter });

    let r = await call(db, "POST", "/api/account/profile", { body: { username: "coasterdad" }, cookie: carter });
    check("the username can be changed", r.status === 200
      && r.data.slug === "coasterdad" && r.data.renamed === true && r.data.was === "tempname",
      JSON.stringify(r.data));

    r = await call(db, "GET", "/api/rides/coasterdad");
    check("...and the rides came with it", r.status === 200 && r.data.rides.length === 2, JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rankings/coasterdad");
    check("...and so did the rankings", r.status === 200 && r.data.order.length === 1);
    check("...and the account still owns the rider",
      rows(db, "SELECT slug FROM accounts")[0].slug === "coasterdad");
    check("...and the activity feed follows, so the history stays attributed",
      rows(db, "SELECT * FROM activity WHERE actor='tempname'").length === 0
      && rows(db, "SELECT * FROM activity WHERE actor='coasterdad'").length > 0);

    // The old id is GONE — not forwarded. This is the behaviour Carter asked
    // for after seeing the alias version, so it is pinned here on purpose.
    check("nothing at all is left under the old username",
      rows(db, "SELECT * FROM users WHERE slug='tempname'").length === 0
      && rows(db, "SELECT * FROM rides WHERE user_slug='tempname'").length === 0
      && rows(db, "SELECT * FROM rankings WHERE user_slug='tempname'").length === 0
      && rows(db, "SELECT * FROM accounts WHERE slug='tempname'").length === 0);
    r = await call(db, "GET", "/api/rides/tempname");
    check("the old URL 404s rather than redirecting", r.status === 404, JSON.stringify(r.data));
    r = await call(db, "GET", "/api/user/tempname");
    check("...on every per-rider read path", r.status === 404);
    r = await call(db, "GET", "/api/rankings/tempname");
    check("...including rankings", r.status === 404);

    // Writes follow the account, which followed the rename.
    r = await call(db, "POST", "/api/rides",
      { body: { user: "coasterdad", d: "2026-06-06", entries: [{ c: 2, n: 1 }] }, cookie: carter });
    check("they can still log to their own count afterwards", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/rides",
      { body: { user: "tempname", d: "2026-06-06", entries: [{ c: 2, n: 1 }] }, cookie: carter });
    check("...and the old name is not a second way into their count", r.status === 401);

    // Renaming twice is just two moves.
    r = await call(db, "POST", "/api/account/profile", { body: { username: "airtime" }, cookie: carter });
    check("renaming again works and takes everything along", r.status === 200
      && (await call(db, "GET", "/api/rides/airtime")).data.rides.length === 3, JSON.stringify(r.data));
    check("...leaving neither of the previous names behind",
      rows(db, "SELECT * FROM users WHERE slug IN ('tempname','coasterdad')").length === 0);
  }

  console.log("\nProfiles — the names you may not take");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    await signedUp(db, "ravi@example.com", "Ravi");

    let r = await call(db, "POST", "/api/account/profile", { body: { username: "ravi" }, cookie: nia });
    check("a username already in use is refused", r.status === 409, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/account/profile", { body: { username: "stats" }, cookie: nia });
    check("a page name is refused", r.status === 409, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/account/profile", { body: { username: "a" }, cookie: nia });
    check("a one-character username is refused", r.status === 409);
    r = await call(db, "POST", "/api/account/profile", { body: { username: "carter" }, cookie: nia });
    check("an existing rider who predates accounts is still protected", r.status === 409);
    r = await call(db, "POST", "/api/account/profile", { body: { username: "   " }, cookie: nia });
    check("an empty username is refused rather than blanking the row", r.status === 400,
      JSON.stringify(r.data));
    check("...and nia is untouched by any of that",
      rows(db, "SELECT slug FROM users WHERE slug='nia'").length === 1);

    // A name someone has moved off is genuinely free. That is the flip side of
    // eliminating the old id rather than forwarding it, and is intended.
    await call(db, "POST", "/api/account/profile", { body: { username: "nia-two" }, cookie: nia });
    const ravi2 = await call(db, "POST", "/api/auth/login",
      { body: { email: "ravi@example.com", password: "riding-things" } });
    r = await call(db, "POST", "/api/account/profile", { body: { username: "nia" }, cookie: ravi2.cookie });
    check("a username its owner has moved off can be taken by someone else",
      r.status === 200 && r.data.slug === "nia", JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rides/nia");
    check("...and it carries none of the previous holder's rides with it",
      r.status === 200 && r.data.user === "Ravi", JSON.stringify(r.data));
    r = await call(db, "GET", "/api/rides/nia-two");
    check("...while the original owner is intact under their new name",
      r.status === 200 && r.data.user === "Nia", JSON.stringify(r.data));
  }

  console.log("\nProfiles — who may edit whom");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    await signedUp(db, "ravi@example.com", "Ravi");

    // Refused outright, NOT quietly applied to the caller's own row — renaming
    // the wrong person is worse than an error, and is what the first cut did.
    let r = await call(db, "POST", "/api/account/profile", { body: { username: "stolen", slug_of: "ravi" }, cookie: nia });
    check("a rider cannot rename another rider", r.status === 401, JSON.stringify(r.data));
    check("...and Ravi keeps their username", rows(db, "SELECT slug FROM users WHERE slug='ravi'").length === 1);
    check("...and the caller was not renamed instead",
      rows(db, "SELECT slug FROM users WHERE slug='nia'").length === 1);
    r = await call(db, "POST", "/api/account/profile", { body: { username: "nobody" } });
    check("signed out, you cannot rename anyone", r.status === 401);

    db.exec("UPDATE accounts SET is_admin = 1 WHERE slug = 'nia'");
    r = await call(db, "POST", "/api/account/profile", { body: { username: "ravi-p", slug_of: "ravi" }, cookie: nia });
    check("an admin can rename someone else", r.status === 200 && r.data.slug === "ravi-p",
      JSON.stringify(r.data));
    check("...and that rider's rides moved with them",
      rows(db, "SELECT * FROM rides WHERE user_slug='ravi'").length === 0);
  }

  console.log("\n/api/ridden — what the headline number counts");
  {
    const db = freshDb();
    // Seed: coasters 1-3 exist, riders have ridden 1 and 2 only.
    let r = await call(db, "GET", "/api/ridden");
    check("lists only coasters somebody has ridden",
      r.status === 200 && r.data.ids.join(",") === "1,2", JSON.stringify(r.data));
    r = await call(db, "GET", "/api/coasters");
    check("...which is FEWER than the coaster table, and that is the point",
      r.data.coasters.length === 3, String(r.data.coasters.length));

    // A coaster added but not yet logged must not join the count.
    await call(db, "POST", "/api/coaster", { body: { name: "Brand New", park: "Cedar Point" }, token: PW });
    r = await call(db, "GET", "/api/ridden");
    check("adding a coaster does not add it to the count", r.data.ids.join(",") === "1,2",
      JSON.stringify(r.data));

    // Logging it does.
    await call(db, "POST", "/api/rides",
      { body: { user: "carter", d: "2026-07-07", entries: [{ c: 4, n: 1 }] }, token: PW });
    r = await call(db, "GET", "/api/ridden");
    check("...and logging a ride on it does", r.data.ids.join(",") === "1,2,4", JSON.stringify(r.data));

    // Ranked-into-existence credits count too, since they are ride rows.
    await call(db, "PUT", "/api/rankings/cole", { body: { order: [3] } });
    r = await call(db, "GET", "/api/ridden");
    check("...as does a credit gained by ranking", r.data.ids.join(",") === "1,2,3,4",
      JSON.stringify(r.data));

    r = await call(db, "GET", "/api/ridden");
    check("it stays a public read — no sign-in needed for a public number",
      r.status === 200);
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
