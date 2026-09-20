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
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PW = "test-password";

// The tables the older migrations made are written out longhand in freshDb();
// this one is applied from the file Carter pastes into the D1 console, so what
// the tests run against is literally what production got. If the file stops
// being valid SQLite, or stops making the shape the Worker queries, these tests
// fail rather than the site does.
const MIGRATION_010 = readFileSync(join(ROOT, "migrations", "010-follows.sql"), "utf8");
const MIGRATION_012 = readFileSync(join(ROOT, "migrations", "012-clone-groups.sql"), "utf8");
const MIGRATION_013 = readFileSync(join(ROOT, "migrations", "013-rider-categories.sql"), "utf8");
const MIGRATION_015 = readFileSync(join(ROOT, "migrations", "015-category-triage.sql"), "utf8");
const MIGRATION_017 = readFileSync(join(ROOT, "migrations", "017-model-triage.sql"), "utf8");

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
    CREATE TABLE users (slug TEXT PRIMARY KEY, name TEXT, mode TEXT, email TEXT, created TEXT,
      bio TEXT, avatar TEXT);
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
    CREATE TABLE resets (token TEXT PRIMARY KEY, account INTEGER NOT NULL, created TEXT NOT NULL,
      expires TEXT NOT NULL, used TEXT);
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
  // Twice, because the file claims to be re-runnable and a migration that is
  // not is a bad afternoon in the D1 console.
  db.exec(MIGRATION_010);
  db.exec(MIGRATION_010);
  db.exec(MIGRATION_012);
  db.exec(MIGRATION_012);
  db.exec(MIGRATION_013);
  db.exec(MIGRATION_013);
  db.exec(MIGRATION_015);
  db.exec(MIGRATION_015);
  return db;
}

// Without migration 012, for the window between this Worker deploying and the
// migration being run.
function dbWithoutClones() {
  const db = freshDb();
  db.exec("DROP TABLE clone_members");
  db.exec("DROP TABLE clone_groups");
  return db;
}

// Without migration 013, for the same window.
function dbWithoutRiderCats() {
  const db = freshDb();
  db.exec("DROP TABLE rider_category_members");
  db.exec("DROP TABLE rider_categories");
  db.exec("DROP TABLE category_prefs");
  return db;
}

// The same database WITHOUT migration 010, for the window between this Worker
// deploying and the migration being run.
function dbWithoutFollows() {
  const db = freshDb();
  db.exec("DROP TABLE follows");
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
  return { status: res.status, data, setCookie: set, cookie: set ? set.split(";")[0] : null,
           cache: res.headers.get("cache-control") };
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

// Outgoing mail, captured. The worker posts to Resend with the global fetch, so
// tests swap it out: nothing leaves the machine, and the email body becomes
// something to assert on — including the link, which is the only place the
// reset token is ever visible.
const OUTBOX = [];
async function callMail(db, method, path, { body, cookie, noKey } = {}) {
  const headers = {};
  if (cookie) headers["cookie"] = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const req = new Request("https://coasterhub.org" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    OUTBOX.push({ url: String(u), body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response(JSON.stringify({ id: "test" }), { status: 200 });
  };
  try {
    const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW };
    if (!noKey) env.RESEND_API_KEY = "re_test_key";
    const res = await worker.fetch(req, env, ctx);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    const set = res.headers.get("set-cookie");
    return { status: res.status, data, cookie: set ? set.split(";")[0] : null };
  } finally { globalThis.fetch = realFetch; }
}
const linkToken = (mail) => (String(mail.body.text).match(/\?reset=([0-9a-f]{64})/) || [])[1];

// R2 stand-in. The real binding is three methods for our purposes, and holding
// the objects in a Map means the tests can assert that a replaced picture is
// actually deleted rather than quietly accumulating.
function fakeR2() {
  const store = new Map();
  return {
    store,
    async put(key, body, opts) { store.set(key, { body, opts }); },
    async get(key) {
      if (!store.has(key)) return null;
      const o = store.get(key);
      return { body: o.body, httpMetadata: o.opts && o.opts.httpMetadata };
    },
    async delete(key) { store.delete(key); },
  };
}

// A call carrying a binary body and an R2 binding, for the avatar routes.
async function callBin(db, method, path, { body, type, cookie, bucket } = {}) {
  const headers = {};
  if (cookie) headers["cookie"] = cookie;
  if (type) headers["content-type"] = type;
  const req = new Request("https://coasterhub.org" + path, { method, headers, body });
  const env = { DB: new FakeD1(db), ADMIN_PASSWORD: PW };
  if (bucket !== null) env.AVATARS = bucket || fakeR2();
  const res = await worker.fetch(req, env, ctx);
  let data = null;
  try { data = await res.json(); } catch { /* an image comes back, not JSON */ }
  return { status: res.status, data, res, env };
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

    // Adding to the coaster list IS open to any account (2026-09-16) — see
    // "Adding to the shared list" below. Editing it is the part that is not.
    r = await call(db, "POST", "/api/coaster", { body: { name: "New One", park: "Cedar Point" }, cookie: nia });
    check("an account DOES open adding to the coaster list", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/merge", { body: { from: 1, to: 2 }, cookie: nia });
    check("...but not merging what is already on it", r.status === 401, JSON.stringify(r.data));
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

    // An ordinary rider may add a coaster, and nothing else here.
    r = await call(db, "POST", "/api/coaster",
      { body: { name: "Newly Ridden", park: "Cedar Point" }, cookie: rider });
    check("a plain rider account can add a coaster", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "PUT", "/api/coaster/1", { body: { name: "Sneaky" }, cookie: rider });
    check("...but cannot rewrite one that is already there", r.status === 401);
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
    // Signing up records `user_added` because the rider is new. Claiming makes
    // no rider, so before this it recorded nothing and somebody taking over
    // their own page never reached /changes.
    {
      const said = rows(db, "SELECT actor, subject FROM activity WHERE kind = 'claimed'");
      check("...and the feed says somebody made an account",
        said.length === 1 && said[0].actor === "carter" && said[0].subject === "Carter",
        JSON.stringify(said));
    }

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

  console.log("\nPassword reset — asking for a link");
  {
    const db = freshDb();
    await signedUp(db, "nia@example.com", "Nia");
    OUTBOX.length = 0;

    let r = await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    check("asking for a link works", r.status === 200 && r.data.sent === true, JSON.stringify(r.data));
    check("...and one email went out, to that address", OUTBOX.length === 1
      && OUTBOX[0].body.to[0] === "nia@example.com", JSON.stringify(OUTBOX));
    check("...from the verified domain, not a gmail address",
      /@coasterhub\.org>?$/.test(String(OUTBOX[0].body.from).replace(/>$/, "") + ">"),
      OUTBOX[0].body.from);
    check("...with the API key as a bearer token", OUTBOX[0].auth === "Bearer re_test_key");
    check("...and a link in the body", !!linkToken(OUTBOX[0]), OUTBOX[0].body.text);
    check("...saying it is single use and how long it lasts",
      /works once/.test(OUTBOX[0].body.text) && /60 minutes/.test(OUTBOX[0].body.text),
      OUTBOX[0].body.text);
    check("...and telling someone who did not ask that nothing has changed",
      /ignore this email/.test(OUTBOX[0].body.text));
    check("the stored row is a HASH, not the token from the link",
      rows(db, "SELECT token FROM resets").every(x => x.token !== linkToken(OUTBOX[0])));

    // The part that must not leak: an unknown address gets the same answer.
    OUTBOX.length = 0;
    const unknown = await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nobody@example.com" } });
    check("an unknown address gets the identical answer",
      unknown.status === 200 && JSON.stringify(unknown.data) === JSON.stringify(r.data),
      JSON.stringify(unknown.data));
    check("...but no email is sent and no row is written",
      OUTBOX.length === 0 && rows(db, "SELECT * FROM resets").length === 1);
    const malformed = await callMail(db, "POST", "/api/auth/forgot", { body: { email: "not-an-email" } });
    check("...as does a malformed one", malformed.status === 200 && OUTBOX.length === 0);

    r = await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" }, noKey: true });
    check("with no API key configured it says so rather than pretending", r.status === 503,
      JSON.stringify(r.data));
  }

  console.log("\nPassword reset — using the link");
  {
    const db = freshDb();
    const old = await signedUp(db, "nia@example.com", "Nia");
    OUTBOX.length = 0;
    await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    const token = linkToken(OUTBOX[0]);

    let r = await call(db, "GET", "/api/auth/reset?token=" + token);
    check("the page can check a link before showing the form",
      r.status === 200 && r.data.email === "nia@example.com", JSON.stringify(r.data));
    check("a forged token 404s", (await call(db, "GET", "/api/auth/reset?token=" + "a".repeat(64))).status === 404);

    r = await call(db, "POST", "/api/auth/reset", { body: { token, password: "short" } });
    check("the new password still has to be long enough", r.status === 400);
    r = await call(db, "POST", "/api/auth/reset", { body: { token, password: "a-whole-new-one" } });
    check("setting a new password works and signs you straight in",
      r.status === 200 && r.data.slug === "nia" && /^ch_sess=/.test(r.cookie || ""),
      JSON.stringify(r.data));
    check("...the new password signs in",
      (await call(db, "POST", "/api/auth/login",
        { body: { email: "nia@example.com", password: "a-whole-new-one" } })).status === 200);
    check("...the old one does not",
      (await call(db, "POST", "/api/auth/login",
        { body: { email: "nia@example.com", password: "riding-things" } })).status === 401);
    check("...and whoever was signed in before is signed out",
      (await call(db, "GET", "/api/auth/me", { cookie: old })).data.account === null);

    r = await call(db, "POST", "/api/auth/reset", { body: { token, password: "another-one-again" } });
    check("the link is single use", r.status === 410, JSON.stringify(r.data));
    check("...and says so rather than pretending it never existed",
      /already been used/.test(r.data.error || ""), JSON.stringify(r.data));
  }

  console.log("\nPassword reset — links that should not work");
  {
    const db = freshDb();
    await signedUp(db, "nia@example.com", "Nia");
    OUTBOX.length = 0;

    // Two requests: the older link must die when the newer one is used, or a
    // stale email in an inbox stays a way in.
    await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    const first = linkToken(OUTBOX[0]), second = linkToken(OUTBOX[1]);
    check("two requests make two different links", first && second && first !== second);
    let r = await call(db, "POST", "/api/auth/reset", { body: { token: second, password: "the-new-one" } });
    check("the newest link works", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/auth/reset", { body: { token: first, password: "sneaky-one" } });
    check("...and using it kills the older one too", r.status === 410, JSON.stringify(r.data));

    // Expiry.
    OUTBOX.length = 0;
    await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    const tok = linkToken(OUTBOX[0]);
    db.prepare("UPDATE resets SET expires = ? WHERE used IS NULL")
      .run(new Date(Date.now() - 60000).toISOString());
    r = await call(db, "GET", "/api/auth/reset?token=" + tok);
    check("an expired link is refused on the check", r.status === 410
      && /expired/.test(r.data.error || ""), JSON.stringify(r.data));
    r = await call(db, "POST", "/api/auth/reset", { body: { token: tok, password: "too-late-now" } });
    check("...and on the write", r.status === 410, JSON.stringify(r.data));
    check("...so the password did not change",
      (await call(db, "POST", "/api/auth/login",
        { body: { email: "nia@example.com", password: "the-new-one" } })).status === 200);
  }

  console.log("\nPassword reset — before migration 007 has run");
  {
    const db = freshDb();
    db.exec("DROP TABLE resets;");
    await signedUp(db, "nia@example.com", "Nia");
    let r = await callMail(db, "POST", "/api/auth/forgot", { body: { email: "nia@example.com" } });
    check("asking for a link names the missing setup rather than 500ing", r.status === 503,
      JSON.stringify(r.data));
    r = await call(db, "GET", "/api/auth/reset?token=" + "a".repeat(64));
    check("...as does checking one", r.status === 503, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/auth/login",
      { body: { email: "nia@example.com", password: "riding-things" } });
    check("and signing in normally is untouched", r.status === 200);
  }

  console.log("\nProfiles — a short bio");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    let r = await call(db, "POST", "/api/account/profile",
      { body: { bio: "Wood over steel, always." }, cookie: nia });
    check("a bio saves on its own, without touching the username",
      r.status === 200 && r.data.bio === "Wood over steel, always." && r.data.renamed === false,
      JSON.stringify(r.data));
    r = await call(db, "GET", "/api/user/nia");
    check("...and comes back on the public profile", r.data.bio === "Wood over steel, always.",
      JSON.stringify(r.data));

    r = await call(db, "POST", "/api/account/profile", { body: { bio: "x".repeat(281) }, cookie: nia });
    check("281 characters is too many", r.status === 400, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/account/profile", { body: { bio: "x".repeat(280) }, cookie: nia });
    check("...280 is fine", r.status === 200);
    r = await call(db, "POST", "/api/account/profile", { body: { bio: "" }, cookie: nia });
    check("an empty bio clears it rather than storing blank",
      r.status === 200 && r.data.bio === null
      && rows(db, "SELECT bio FROM users WHERE slug='nia'")[0].bio === null, JSON.stringify(r.data));

    const ravi = await signedUp(db, "ravi@example.com", "Ravi");
    r = await call(db, "POST", "/api/account/profile",
      { body: { bio: "not mine to write", slug_of: "nia" }, cookie: ravi });
    check("you cannot write someone else's bio", r.status === 401, JSON.stringify(r.data));
  }

  console.log("\nProfiles — the picture");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    const bucket = fakeR2();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

    let r = await callBin(db, "POST", "/api/account/avatar",
      { body: png, type: "image/png", cookie: nia, bucket });
    check("uploading a picture stores it and names the key",
      r.status === 200 && /^nia-[0-9a-f]{16}\.png$/.test(r.data.avatar || ""), JSON.stringify(r.data));
    check("...the object is really in the bucket", bucket.store.has(r.data.avatar));
    check("...and the rider row points at it",
      rows(db, "SELECT avatar FROM users WHERE slug='nia'")[0].avatar === r.data.avatar);
    const firstKey = r.data.avatar;

    r = await callBin(db, "GET", "/avatars/" + firstKey, { bucket });
    check("it serves from coasterhub.org, not a third party", r.status === 200
      && r.res.headers.get("content-type") === "image/png", r.res.headers.get("content-type"));
    check("...cached hard, which is safe because the key changes on replace",
      /immutable/.test(r.res.headers.get("cache-control") || ""), r.res.headers.get("cache-control"));

    // Replacing must not leave the old object behind.
    r = await callBin(db, "POST", "/api/account/avatar",
      { body: png, type: "image/jpeg", cookie: nia, bucket });
    check("replacing it writes a new key", r.status === 200 && r.data.avatar !== firstKey,
      JSON.stringify(r.data));
    check("...and deletes the old object rather than accumulating",
      !bucket.store.has(firstKey) && bucket.store.size === 1,
      [...bucket.store.keys()].join(","));

    r = await callBin(db, "GET", "/avatars/" + firstKey, { bucket });
    check("...so the old URL stops resolving", r.status === 404);

    // What must not be uploadable.
    r = await callBin(db, "POST", "/api/account/avatar",
      { body: png, type: "text/html", cookie: nia, bucket });
    check("an HTML file is refused — this is served from our own origin", r.status === 400,
      JSON.stringify(r.data));
    r = await callBin(db, "POST", "/api/account/avatar",
      { body: new Uint8Array(600 * 1024), type: "image/png", cookie: nia, bucket });
    check("an oversized image is refused", r.status === 413, JSON.stringify(r.data));
    r = await callBin(db, "POST", "/api/account/avatar",
      { body: png, type: "image/png", bucket });
    check("signed out, you cannot upload", r.status === 401);

    // Removing.
    const live = rows(db, "SELECT avatar FROM users WHERE slug='nia'")[0].avatar;
    r = await callBin(db, "DELETE", "/api/account/avatar", { cookie: nia, bucket });
    check("removing it clears the row and the object",
      r.status === 200 && r.data.avatar === null
      && rows(db, "SELECT avatar FROM users WHERE slug='nia'")[0].avatar === null
      && !bucket.store.has(live), JSON.stringify(r.data));

    // And with no bucket bound at all.
    r = await callBin(db, "POST", "/api/account/avatar",
      { body: png, type: "image/png", cookie: nia, bucket: null });
    check("with no R2 bucket bound it says so rather than 500ing", r.status === 503,
      JSON.stringify(r.data));
    r = await callBin(db, "GET", "/avatars/anything.png", { bucket: null });
    check("...and an avatar URL 404s rather than throwing", r.status === 404);
  }

  console.log("\nProfiles — avatars on the rider list");
  {
    const db = freshDb();
    const nia = await signedUp(db, "nia@example.com", "Nia");
    const bucket = fakeR2();
    const up = await callBin(db, "POST", "/api/account/avatar",
      { body: new Uint8Array([1,2,3]), type: "image/png", cookie: nia, bucket });
    const r = await call(db, "GET", "/api/users");
    const me = r.data.users.filter(u => u.slug === "nia")[0];
    check("the rider list carries the avatar key, so pickers can show faces",
      me && me.avatar === up.data.avatar, JSON.stringify(me));
    const other = r.data.users.filter(u => u.slug === "carter")[0];
    check("...and null for anyone without one", other && other.avatar === null,
      JSON.stringify(other));
  }

  console.log("\nAdding to the shared list — an account is enough");
  {
    const db = freshDb();
    const rider = await signedUp(db, "newbie@example.com", "Newbie");

    let r = await callNoPassword(db, "POST", "/api/coaster",
      { cookie: rider, body: { name: "Brand New", park: "Cedar Point", type: "Steel" } });
    check("a signed-in rider can add a coaster nobody has heard of",
      r.status === 200 && r.data.ok, JSON.stringify(r.data));
    const added = r.data.id;
    check("...and it is on the list straight away",
      (await call(db, "GET", "/api/coasters")).data.coasters.some(c => c.id === added));

    r = await callNoPassword(db, "POST", "/api/coaster", { body: { name: "Nope", park: "Cedar Point" } });
    check("a signed-OUT visitor still cannot", r.status === 401, JSON.stringify(r.data));

    r = await callNoPassword(db, "PUT", "/api/park",
      { cookie: rider, body: { name: "Brand New Park", region: "Somewhere" } });
    check("a signed-in rider can add a park their coaster needs",
      r.status === 200 && (await call(db, "GET", "/api/parks")).data["Brand New Park"], JSON.stringify(r.data));

    // The important half: creating is open, editing what is already there is not.
    await callNoPassword(db, "PUT", "/api/park",
      { cookie: rider, body: { name: "Cedar Point", region: "Moved, Nowhere", lat: 0, lon: 0 } });
    let parks = (await call(db, "GET", "/api/parks")).data;
    check("...but cannot move a park that already exists",
      parks["Cedar Point"].region === "Ohio, US" && parks["Cedar Point"].lat !== 0,
      JSON.stringify(parks["Cedar Point"]));

    r = await call(db, "PUT", "/api/park",
      { token: PW, body: { name: "Cedar Point", region: "Ohio, USA" } });
    parks = (await call(db, "GET", "/api/parks")).data;
    check("...while an admin still can", r.status === 200 && parks["Cedar Point"].region === "Ohio, USA",
      JSON.stringify(parks["Cedar Point"]));

    r = await callNoPassword(db, "PUT", "/api/coaster/1", { cookie: rider, body: { name: "Renamed" } });
    check("editing an existing coaster is still admin only", r.status === 401, JSON.stringify(r.data));
    r = await callNoPassword(db, "DELETE", "/api/coaster/1", { cookie: rider });
    check("deleting one is too", r.status === 401, JSON.stringify(r.data));
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

  // ---- following ----------------------------------------------------------
  {
    const db = freshDb();
    const ada = await signedUp(db, "ada@example.com", "Ada");
    const bo  = await signedUp(db, "bo@example.com", "Bo");

    let r = await call(db, "GET", "/api/follows/bo");
    check("follows: readable signed out", r.status === 200
      && r.data.followers.length === 0 && r.data.following.length === 0);
    check("follows: signed-out reader is nobody, so nothing to act on",
      r.data.me === null && r.data.you === false, JSON.stringify(r.data));
    check("follows: an account makes a page claimed", r.data.claimed === true);

    r = await call(db, "GET", "/api/follows/carter");
    check("follows: a rider with no account is unclaimed", r.data.claimed === false);

    r = await call(db, "POST", "/api/follow/bo", { cookie: ada });
    check("follow: writes and answers with the fresh lists", r.status === 200
      && r.data.you === true && r.data.followers.length === 1
      && r.data.followers[0].slug === "ada", JSON.stringify(r.data));
    check("follow: one row, and it is the pair",
      rows(db, "SELECT follower, followee FROM follows").length === 1
      && rows(db, "SELECT follower FROM follows")[0].follower === "ada");

    r = await call(db, "POST", "/api/follow/bo", { cookie: ada });
    check("follow: doing it twice is not an error and not a second row",
      r.status === 200 && rows(db, "SELECT 1 FROM follows").length === 1);

    r = await call(db, "GET", "/api/follows/bo", { cookie: ada });
    check("follows: the follower is told they follow", r.data.you === true);
    r = await call(db, "GET", "/api/follows/ada", { cookie: ada });
    check("follows: and it shows on the other side as following",
      r.data.following.length === 1 && r.data.following[0].slug === "bo"
      && r.data.you === false, JSON.stringify(r.data));

    // The three refusals.
    r = await call(db, "POST", "/api/follow/ada", { cookie: ada });
    check("follow: you cannot follow yourself", r.status === 400);
    r = await call(db, "POST", "/api/follow/carter", { cookie: ada });
    check("follow: you cannot follow an unclaimed rider", r.status === 409, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/follow/bo");
    check("follow: signed out is refused", r.status === 401);
    r = await call(db, "POST", "/api/follow/bo", { token: PW });
    check("follow: the shared admin password is nobody, so it cannot follow either",
      r.status === 401, JSON.stringify(r.data));
    r = await call(db, "POST", "/api/follow/nobody-at-all", { cookie: ada });
    check("follow: an unknown rider is a 404", r.status === 404);
    check("follow: none of the refusals wrote anything",
      rows(db, "SELECT 1 FROM follows").length === 1);

    // A follow is not a coaster fact, so it stays out of the changes feed.
    const acts = rows(db, "SELECT kind FROM activity").map(a => a.kind);
    check("follow: nothing lands in the activity feed",
      !acts.some(k => String(k).includes("follow")), acts.join(","));

    // A rename has to carry both sides or a follow detaches from its person.
    r = await call(db, "POST", "/api/account/profile", { cookie: bo, body: { username: "bojangles" } });
    check("rename: the rename itself works with follows present", r.status === 200,
      JSON.stringify(r.data));
    check("rename: the followee moved with it",
      rows(db, "SELECT followee FROM follows")[0].followee === "bojangles",
      JSON.stringify(rows(db, "SELECT * FROM follows")));
    r = await call(db, "POST", "/api/account/profile", { cookie: ada, body: { username: "adalovelace" } });
    check("rename: the follower moved too",
      rows(db, "SELECT follower FROM follows")[0].follower === "adalovelace");
    r = await call(db, "GET", "/api/follows/bojangles");
    check("rename: and the list still names a real person",
      r.data.followers.length === 1 && r.data.followers[0].slug === "adalovelace",
      JSON.stringify(r.data));

    r = await call(db, "DELETE", "/api/follow/bojangles", { cookie: ada });
    check("unfollow: removes the row and says so", r.status === 200
      && r.data.you === false && rows(db, "SELECT 1 FROM follows").length === 0);
    r = await call(db, "DELETE", "/api/follow/bojangles", { cookie: ada });
    check("unfollow: unfollowing what you do not follow is fine", r.status === 200);
  }

  // ---- the window before the migration is run ------------------------------
  // There is always one: the Worker deploys, the SQL has not been pasted yet.
  // Every route must say which file is missing rather than 500, and nothing
  // else on the site may break.
  {
    const db = dbWithoutFollows();
    const ada = await signedUp(db, "ada@example.com", "Ada");

    let r = await call(db, "GET", "/api/follows/carter");
    check("no migration: reading follows is a 503 naming the file",
      r.status === 503 && /010-follows\.sql/.test(r.data.error || ""), JSON.stringify(r.data));
    r = await call(db, "POST", "/api/follow/carter", { cookie: ada });
    check("no migration: following is a 503 naming the file",
      r.status === 503 && /010-follows\.sql/.test(r.data.error || ""), JSON.stringify(r.data));
    r = await call(db, "DELETE", "/api/follow/carter", { cookie: ada });
    check("no migration: unfollowing is a 503 naming the file", r.status === 503);

    // The rename puts its follows updates in their own guarded batch precisely
    // so this still works.
    r = await call(db, "POST", "/api/account/profile", { cookie: ada, body: { username: "adalovelace" } });
    check("no migration: a rename still succeeds", r.status === 200, JSON.stringify(r.data));
    r = await call(db, "GET", "/api/user/carter");
    check("no migration: the rest of the site is unaffected", r.status === 200);
  }

  // ---- nothing live may be served from a browser cache ---------------------
  // A response with no cache-control is not "do not cache": with no max-age and
  // no validator a browser guesses, and a profile came back wearing its owner's
  // previous picture because /api/auth/me was answered from that guess.
  {
    const db = freshDb();
    const cookie = await signedUp(db, "cache@example.com", "Cacher");
    const live = ["/api/auth/me", "/api/users", "/api/user/carter", "/api/rides/carter",
                  "/api/rankings/carter", "/api/follows/carter", "/api/activity"];
    for (const path of live) {
      const r = await call(db, "GET", path, { cookie });
      check("no-store on " + path, r.cache === "no-store", String(r.cache));
    }
    // An error must not be cached either — a 404 that sticks is worse than one
    // that does not.
    let r = await call(db, "GET", "/api/user/nobody");
    check("no-store on an error too", r.cache === "no-store", String(r.cache));
    // ...and the two big lists opt back in explicitly rather than being guessed.
    for (const path of ["/api/coasters", "/api/parks"]) {
      r = await call(db, "GET", path);
      check("an explicit short cache on " + path,
        r.cache === "public, max-age=300", String(r.cache));
    }
  }

  // ---- claiming picks its own name AND username ----------------------------
  // The name a rider arrives with is a placeholder; claiming is where it becomes
  // theirs. The old one has to vanish completely, feed included.
  {
    const db = freshDb();
    const admin = await signedUp(db, "boss@example.com", "Boss");
    db.prepare("UPDATE accounts SET is_admin = 1 WHERE slug = 'boss'").run();
    // carter is the seeded rider with rides + a ranking to carry across
    db.prepare("INSERT INTO rankings (user_slug,coaster_id,pos) VALUES ('carter',1,1)").run();
    const before = rows(db, "SELECT COUNT(*) c FROM rides WHERE user_slug='carter'")[0].c;

    let r = await call(db, "POST", "/api/admin/invite", { cookie: admin, body: { slug: "carter" } });
    check("invite issued", r.status === 200 && /\?claim=/.test(r.data.url), JSON.stringify(r.data));
    const code = r.data.url.split("claim=")[1];

    r = await call(db, "POST", "/api/auth/claim", { body: {
      code, name: "Carter B", username: "firephoenix",
      email: "new@example.com", password: "riding-things" } });
    check("claim with a new name and username", r.status === 200 && r.data.slug === "firephoenix",
      JSON.stringify(r.data));

    check("the rider moved", rows(db, "SELECT slug, name FROM users WHERE slug='firephoenix'")[0].name === "Carter B");
    check("the old username is gone", rows(db, "SELECT slug FROM users WHERE slug='carter'").length === 0);
    check("every ride came with it",
      rows(db, "SELECT COUNT(*) c FROM rides WHERE user_slug='firephoenix'")[0].c === before && before > 0);
    check("so did the ranking",
      rows(db, "SELECT COUNT(*) c FROM rankings WHERE user_slug='firephoenix'")[0].c === 1);
    check("the account is attached to the NEW slug",
      rows(db, "SELECT slug FROM accounts WHERE lower(email)='new@example.com'")[0].slug === "firephoenix");
    check("the invite is spent", rows(db, "SELECT used FROM invites WHERE code=?", code) &&
      db.prepare("SELECT used FROM invites WHERE code = ?").get(code).used !== null);
    // The whole point: nothing anywhere still says "carter".
    const feed = rows(db, "SELECT kind, actor, subject FROM activity");
    check("no rename lands in the public feed",
      !feed.some(e => e.kind === "user_renamed"), JSON.stringify(feed));
    check("the placeholder is nowhere in the feed",
      !feed.some(e => e.actor === "carter" || e.subject === "carter"), JSON.stringify(feed));
    r = await call(db, "GET", "/api/user/carter");
    check("the old page is a 404", r.status === 404);

    // Both fields are optional: a claim that sends neither keeps what was there.
    r = await call(db, "POST", "/api/admin/invite", { cookie: admin, body: { slug: "cole" } });
    const code2 = r.data.url.split("claim=")[1];
    r = await call(db, "POST", "/api/auth/claim", { body: {
      code: code2, email: "cole@example.com", password: "riding-things" } });
    check("claiming without them keeps the old name", r.status === 200 && r.data.slug === "cole" &&
      rows(db, "SELECT name FROM users WHERE slug='cole'")[0].name === "Cole", JSON.stringify(r.data));

    // And a username somebody else holds is refused, with nothing written.
    r = await call(db, "POST", "/api/admin/invite", { cookie: admin, body: { slug: "max" } });
    const code3 = r.data.url.split("claim=")[1];
    r = await call(db, "POST", "/api/auth/claim", { body: {
      code: code3, username: "firephoenix", email: "max@example.com", password: "riding-things" } });
    check("a taken username is refused", r.status === 400 && /taken/.test(r.data.error || ""),
      JSON.stringify(r.data));
    check("...and the invite is still unspent",
      db.prepare("SELECT used FROM invites WHERE code = ?").get(code3).used === null);
    check("...and no account was made",
      rows(db, "SELECT id FROM accounts WHERE lower(email)='max@example.com'").length === 0);
    r = await call(db, "POST", "/api/auth/claim", { body: {
      code: code3, username: "api", email: "max@example.com", password: "riding-things" } });
    check("a reserved username is refused", r.status === 400, JSON.stringify(r.data));
  }

  // ---- credit bursts merge, dated rides do not -----------------------------
  {
    const db = freshDb();
    const cookie = await signedUp(db, "burst@example.com", "Burst");
    const slug = "burst";
    const feed = () => rows(db, "SELECT kind, n, detail FROM activity WHERE actor = '" + slug + "'");

    // Three separate undated saves, the way ticking three parks goes.
    for (const c of [[1],[2],[3]]) {
      const r = await call(db, "POST", "/api/rides", { cookie,
        body: { user: slug, d: null, entries: c.map(id => ({ c: id, n: 1 })) } });
      check("credit save " + c[0] + " accepted", r.status === 200, JSON.stringify(r.data));
    }
    let evs = feed().filter(e => e.kind === "credits");
    check("three credit saves collapse to one row", evs.length === 1, JSON.stringify(evs));
    check("...and it counts all three", evs[0].n === 3, JSON.stringify(evs[0]));
    const det = JSON.parse(evs[0].detail || "{}");
    check("...and remembers it was three saves", det.saves === 3, evs[0].detail);

    // Dated rides stay one row each — a day out is a fact on its own.
    for (const d of ["2024-06-01", "2024-06-02"]) {
      await call(db, "POST", "/api/rides", { cookie,
        body: { user: slug, d, entries: [{ c: 1, n: 1 }] } });
    }
    evs = feed().filter(e => e.kind === "rides");
    check("two dated saves stay two rows", evs.length === 2, JSON.stringify(evs));

    // A different rider never merges into somebody else's row.
    const other = await signedUp(db, "other@example.com", "Other");
    await call(db, "POST", "/api/rides", { cookie: other,
      body: { user: "other", d: null, entries: [{ c: 2, n: 1 }] } });
    check("another rider gets their own row",
      rows(db, "SELECT actor FROM activity WHERE kind = 'credits'").length === 2);

    // An hour later is a new sitting. Needs a coaster this rider does NOT hold:
    // the undated guard skips one they already have, which writes no rows and so
    // records no event at all.
    db.prepare("INSERT INTO coasters (id,name,park,type) VALUES (4,'Gemini','Cedar Point','Steel')").run();
    db.prepare("UPDATE activity SET at = '2020-01-01T00:00:00.000Z' WHERE kind = 'credits' AND actor = ?")
      .run(slug);
    await call(db, "POST", "/api/rides", { cookie,
      body: { user: slug, d: null, entries: [{ c: 4, n: 1 }] } });
    check("a stale row is not merged into",
      rows(db, "SELECT id FROM activity WHERE kind = 'credits' AND actor = '" + slug + "'").length === 2);
  }

  // ---- clone groups -------------------------------------------------------
  {
    const db = freshDb();
    // Three Batmans that ARE one ride, one that is not: same name, different
    // model. The suggester has to tell them apart, which is the whole reason
    // this is curated and not computed.
    db.exec(`
      INSERT INTO coasters (id,name,park,type,manu,model) VALUES
        (11,'Batman: The Ride','Six Flags Great America','Steel','B&M','B&M Invert'),
        (12,'Batman: The Ride','Six Flags Great Adventure','Steel','B&M','B&M Invert'),
        (13,'Batman: The Ride','Six Flags Fiesta Texas','Steel','S&S','FreeSpin'),
        (14,'Boomerang','Six Flags St. Louis','Steel','Vekoma','Boomerang'),
        (15,'Boomerang','Knott''s','Steel','Vekoma','Boomerang');
    `);
    const cookie = await signedUp(db, "clone@example.com", "Cloner");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "GET", "/api/admin/clones/suggest", { cookie });
    const fams = r.data.groups || [];
    const batman = fams.find((g) => g.name === "Batman: The Ride");
    check("suggests a name+model family", !!batman && batman.members.length === 2,
      JSON.stringify(fams.map((g) => g.name + " x" + g.members.length)));
    check("does not put a FreeSpin in with the B&M Inverts",
      !!batman && !batman.members.some((m) => m.id === 13));

    r = await call(db, "POST", "/api/clones",
      { cookie, body: { name: "Batman: The Ride", note: "B&M Invert", ids: [11, 12] } });
    check("creates a group", r.status === 200 && r.data.ok, r.status + " " + JSON.stringify(r.data));
    const gid = r.data.id;

    r = await call(db, "GET", "/api/clones");
    check("the group reads back with its members",
      r.data.groups.length === 1 && r.data.groups[0].ids.sort().join() === "11,12",
      JSON.stringify(r.data.groups));

    r = await call(db, "GET", "/api/admin/clones/suggest", { cookie });
    check("an answered family stops being suggested",
      !(r.data.groups || []).some((g) => g.name === "Batman: The Ride"));

    r = await call(db, "POST", "/api/clones",
      { cookie, body: { name: "Somebody else's", ids: [11, 14] } });
    check("a coaster cannot join two families", r.status === 409, r.status + " " + JSON.stringify(r.data));

    r = await call(db, "POST", "/api/clones", { cookie, body: { name: "Lonely", ids: [14] } });
    check("one coaster is not a group", r.status === 400);
    r = await call(db, "POST", "/api/clones", { cookie, body: { name: "", ids: [14, 15] } });
    check("a group needs a name", r.status === 400);
    r = await call(db, "POST", "/api/clones", { cookie, body: { name: "Ghosts", ids: [14, 999] } });
    check("a group cannot hold a coaster that does not exist", r.status === 404);

    r = await call(db, "PUT", "/api/clones/" + gid,
      { cookie, body: { name: "Batman clones", note: "B&M Invert", ids: [11, 12, 13] } });
    check("replacing the members works", r.status === 200 && r.data.ids.length === 3,
      r.status + " " + JSON.stringify(r.data));
    r = await call(db, "GET", "/api/clones");
    check("and leaves no orphans behind",
      rows(db, "SELECT coaster FROM clone_members").length === 3 &&
      r.data.groups[0].name === "Batman clones");

    r = await call(db, "DELETE", "/api/clones/" + gid, { cookie });
    check("deleting a group takes its members with it",
      r.status === 200 && rows(db, "SELECT coaster FROM clone_members").length === 0);
    r = await call(db, "DELETE", "/api/clones/" + gid, { cookie });
    check("deleting it twice is a 404, not a 500", r.status === 404);

    // Signed in but not admin: curating the shared list is not open to accounts
    // the way adding a missing coaster is.
    const plain = await signedUp(db, "plain@example.com", "Plain");
    r = await callNoPassword(db, "POST", "/api/clones",
      { cookie: plain, body: { name: "Mine", ids: [14, 15] } });
    check("a plain account cannot curate clones", r.status === 401, String(r.status));
  }

  // The window where the code is live and the migration is not.
  {
    const db = dbWithoutClones();
    let r = await call(db, "GET", "/api/clones");
    check("no migration yet: the public read is empty, not an error",
      r.status === 200 && Array.isArray(r.data.groups) && r.data.groups.length === 0);
    const cookie = await signedUp(db, "pre@example.com", "Pre");
    db.prepare("UPDATE accounts SET is_admin = 1").run();
    r = await call(db, "POST", "/api/clones", { cookie, body: { name: "X", ids: [1, 2] } });
    check("no migration yet: a write is a 503 naming the file",
      r.status === 503 && /012-clone-groups\.sql/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));
  }

  // ---- a rider's own categories --------------------------------------------
  {
    const db = freshDb();
    db.exec(`
      INSERT INTO coasters (id,name,park,type,manu,model) VALUES
        (21,'Batman: The Ride','Six Flags Great America','Steel','B&M','B&M Invert'),
        (22,'Batman: The Ride','Six Flags Great Adventure','Steel','B&M','B&M Invert'),
        (23,'Wacky Worm','Some Fair','Steel','SBF','Wacky Worm'),
        (24,'Wacky Worm','Another Fair','Steel','SBF','Wacky Worm'),
        (25,'Sea Serpent','A Pier','Steel','Vekoma','Boomerang');
      -- The site's own category, as /edit would have written it.
      INSERT INTO clone_groups (id,name,note,created) VALUES (1,'Batman: The Ride','B&M Invert','2026-09-18');
      INSERT INTO clone_members (coaster,group_id) VALUES (21,1),(22,1);
    `);
    const cookie = await signedUp(db, "own@example.com", "Riley");
    const slug = db.prepare("SELECT slug FROM accounts WHERE email = 'own@example.com'").get().slug;

    let r = await call(db, "GET", "/api/categories/" + slug);
    check("reads the site's categories without signing in",
      r.status === 200 && r.data.categories.length === 1 &&
      r.data.categories[0].key === "c1" && r.data.categories[0].official === true,
      JSON.stringify(r.data));
    check("a category is on until somebody says otherwise", r.data.on === true);

    r = await call(db, "GET", "/api/categories/nobody");
    check("an unknown rider is a 404", r.status === 404);

    // The rule Carter asked for: you cannot build your own out of the site's.
    r = await call(db, "POST", "/api/categories/" + slug,
      { cookie, body: { name: "My Batmans", ids: [21, 22] } });
    check("cannot fork a Coaster Hub category into your own",
      r.status === 409 && /Coaster Hub category/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));

    r = await call(db, "POST", "/api/categories/" + slug,
      { cookie, body: { name: "Wacky Worms", note: "the same worm", ids: [23, 24] } });
    check("creates one of your own", r.status === 200 && r.data.key === "r1",
      r.status + " " + JSON.stringify(r.data));
    const mine = r.data.id;

    r = await call(db, "POST", "/api/categories/" + slug,
      { cookie, body: { name: "Worms again", ids: [23, 25] } });
    check("a ride cannot be in two of your categories",
      r.status === 409 && /already in your/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));

    r = await call(db, "POST", "/api/categories/" + slug, { cookie, body: { name: "Solo", ids: [23] } });
    check("one ride is not a category", r.status === 400);
    r = await call(db, "POST", "/api/categories/" + slug, { cookie, body: { name: "", ids: [23, 24] } });
    check("a category needs a name", r.status === 400);
    r = await call(db, "POST", "/api/categories/" + slug, { cookie, body: { name: "Ghosts", ids: [23, 9999] } });
    check("a category of rides that do not exist is a 404", r.status === 404);

    r = await call(db, "GET", "/api/categories/" + slug);
    const own = r.data.categories.filter((c) => !c.official);
    check("yours comes back beside the site's, marked as yours",
      r.data.categories.length === 2 && own.length === 1 &&
      own[0].name === "Wacky Worms" && own[0].ids.length === 2,
      JSON.stringify(r.data.categories));

    r = await call(db, "PUT", "/api/categories/" + slug + "/" + mine,
      { cookie, body: { name: "Every worm", ids: [23, 24, 25] } });
    check("replacing one keeps its id and swaps its members",
      r.status === 200 && r.data.id === mine &&
      rows(db, "SELECT coaster FROM rider_category_members").length === 3,
      r.status + " " + JSON.stringify(r.data));

    // Preferences: what is switched off, and what shows numbers.
    r = await call(db, "PUT", "/api/categories/" + slug + "/prefs",
      { cookie, body: { on: true, off: ["c1"], nums: ["r" + mine, "nonsense"],
                        pulled: [23, 0, "x", 23] } });
    check("saves preferences, dropping a key that is not one",
      r.status === 200 && r.data.off.length === 1 && r.data.nums.length === 1,
      JSON.stringify(r.data));
    check("...and the rides ranked on their own, deduped and cleaned",
      r.data.pulled.length === 1 && r.data.pulled[0] === 23, JSON.stringify(r.data.pulled));

    r = await call(db, "GET", "/api/categories/" + slug);
    const site = r.data.categories.filter((c) => c.official)[0];
    check("the site's category comes back switched off for this rider",
      site.off === true && r.data.categories.filter((c) => !c.official)[0].nums === true,
      JSON.stringify(r.data.categories));
    check("...and so does what is ranked on its own",
      Array.isArray(r.data.pulled) && r.data.pulled[0] === 23, JSON.stringify(r.data.pulled));

    // Switching the site's one off makes those rides ordinary rows for this
    // rider. It does NOT let them be rebuilt as a private copy — that is the
    // same fork by another route, and it is refused the same way.
    r = await call(db, "POST", "/api/categories/" + slug, { cookie, body: { name: "Mine", ids: [21, 22] } });
    check("switching it off is still not a way to copy it", r.status === 409,
      r.status + " " + JSON.stringify(r.data));

    // Somebody else's account.
    const other = await signedUp(db, "other@example.com", "Wren");
    r = await call(db, "POST", "/api/categories/" + slug,
      { cookie: other, body: { name: "Yours now", ids: [23, 24] } });
    check("another rider cannot write your categories", r.status === 401);
    r = await call(db, "DELETE", "/api/categories/" + slug + "/" + mine, { cookie: other });
    check("another rider cannot delete your categories", r.status === 401);

    const wrenSlug = db.prepare("SELECT slug FROM accounts WHERE email = 'other@example.com'").get().slug;
    r = await call(db, "DELETE", "/api/categories/" + wrenSlug + "/" + mine, { cookie: other });
    check("somebody else's category id is a 404, not a 403", r.status === 404);

    r = await call(db, "DELETE", "/api/categories/" + slug + "/" + mine, { cookie });
    check("deleting one takes its members with it",
      r.status === 200 && rows(db, "SELECT coaster FROM rider_category_members").length === 0);
  }

  // ---- triage ---------------------------------------------------------------
  {
    const db = freshDb();
    const cookie = await signedUp(db, "triage@example.com", "Tri");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "GET", "/api/admin/categories/skipped", { cookie });
    check("nothing set aside to begin with", r.status === 200 && r.data.ids.length === 0);

    r = await call(db, "POST", "/api/admin/categories/skipped", { cookie, body: { ids: [1, 2, 2] } });
    check("setting some aside dedupes them", r.status === 200 && r.data.n === 2,
      JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/categories/skipped", { cookie, body: { ids: [1] } });
    check("...and doing it twice is not an error", r.status === 200);

    r = await call(db, "GET", "/api/admin/categories/skipped", { cookie });
    check("they come back", r.status === 200 && r.data.ids.length === 2,
      JSON.stringify(r.data.ids));

    r = await call(db, "POST", "/api/admin/categories/skipped",
      { cookie, body: { ids: [1], on: false } });
    check("putting one back into the queue", r.status === 200 && r.data.on === false);
    r = await call(db, "GET", "/api/admin/categories/skipped", { cookie });
    check("...leaves the other", r.data.ids.length === 1 && r.data.ids[0] === 2,
      JSON.stringify(r.data.ids));

    r = await call(db, "POST", "/api/admin/categories/skipped", { cookie, body: { ids: [] } });
    check("no coasters is a 400", r.status === 400);
    r = await call(db, "GET", "/api/admin/categories/skipped");
    check("triage needs an admin", r.status === 401);

    // Before the migration: the read still answers, the write names the file.
    const old = freshDb();
    old.exec("DROP TABLE category_skipped");
    const c2 = await signedUp(old, "pre15@example.com", "Pre");
    old.prepare("UPDATE accounts SET is_admin = 1").run();
    r = await call(old, "GET", "/api/admin/categories/skipped", { cookie: c2 });
    check("no migration yet: the read is empty, not an error",
      r.status === 200 && r.data.ids.length === 0 && /015/.test(r.data.need || ""),
      JSON.stringify(r.data));
    r = await call(old, "POST", "/api/admin/categories/skipped", { cookie: c2, body: { ids: [1] } });
    check("no migration yet: the write is a 503 naming the file",
      r.status === 503 && /015-category-triage\.sql/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));
  }

  // ---- a whole count arriving at once is one line ---------------------------
  //
  // An import keeps its dates by posting one call per day ridden, so a count
  // the size of Nick's wrote twenty feed rows. `bulk` says the calls are one
  // act; they merge into a single "imported N credits".
  {
    const db = freshDb();
    db.exec("INSERT INTO coasters (id,name,park) VALUES (71,'A','P'),(72,'B','P'),(73,'C','Q')");
    db.prepare("INSERT INTO users (slug,name,mode) VALUES ('nick','Nick','rides')").run();

    let r = await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "nick", d: "2021-06-03", bulk: true, entries: [{ c: 71, n: 1 }] } });
    check("a bulk call writes rides as usual", r.status === 200 && r.data.added === 1);
    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "nick", d: "2021-06-04", bulk: true, entries: [{ c: 72, n: 1 }] } });
    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "nick", d: null, bulk: true, entries: [{ c: 73, n: 1 }] } });

    const feed = rows(db, "SELECT kind, n, detail FROM activity WHERE actor = 'nick'");
    check("...three calls, one feed row", feed.length === 1 && feed[0].kind === "import",
      JSON.stringify(feed));
    check("...carrying every credit", feed[0].n === 3, JSON.stringify(feed[0]));
    const det = JSON.parse(feed[0].detail);
    check("...and the dated days, counted once each",
      det.rides === 3 && det.days.length === 2 && det.calls === 3, feed[0].detail);

    // An ordinary log is untouched: two park days in one evening are two things
    // that happened, and merging them would say otherwise.
    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "carter", d: "2024-07-01", entries: [{ c: 71, n: 1 }] } });
    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "carter", d: "2024-07-02", entries: [{ c: 72, n: 1 }] } });
    check("a normal log still writes a row per day",
      rows(db, "SELECT id FROM activity WHERE actor = 'carter' AND kind = 'rides'").length === 2);

    // And an import an hour later is a second import, not more of the first.
    db.prepare("UPDATE activity SET at = ? WHERE actor = 'nick'")
      .run(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    await call(db, "POST", "/api/rides",
      { token: PW, body: { user: "nick", d: "2022-01-01", bulk: true, entries: [{ c: 72, n: 1 }] } });
    check("...an import an hour later is its own line",
      rows(db, "SELECT id FROM activity WHERE actor = 'nick' AND kind = 'import'").length === 2);
  }

  // ---- a merge carries everything keyed by the coaster ----------------------
  //
  // It used to move the rides and the aliases and stop there, so the coaster
  // that disappeared took its category membership and every ranking holding it
  // into a row nothing could resolve. Carter merged Goliath into Chupacabra on
  // 2026-09-20 and the Batman clones category was left showing "#137".
  {
    const db = freshDb();
    db.exec(`
      -- #1 is the survivor and carries almost nothing; #2 is the row with the
      -- specs on it, which is the shape a retheme leaves behind.
      UPDATE coasters SET manu = NULL, model = NULL WHERE id = 1;
      UPDATE coasters SET manu = 'B&M', model = 'Invert', h = 105, s = 50, l = 2693,
        inv = 5, dur = 120, yr = 2008, opened = '2008-04-18' WHERE id = 2;
      INSERT INTO clone_groups (id,name,created) VALUES (1,'Batman clones','x');
      INSERT INTO clone_members (coaster,group_id) VALUES (2,1);
      INSERT INTO rankings (user_slug,coaster_id,pos) VALUES ('carter',2,1),('cole',1,2),('cole',2,3);
      INSERT INTO rider_categories (id,user_slug,name,created) VALUES (9,'cole','Mine','x');
      INSERT INTO rider_category_members (user_slug,coaster,cat_id) VALUES ('cole',2,9);
      INSERT INTO category_skipped (coaster,at) VALUES (2,'x');
    `);
    await call(db, "POST", "/api/merge", { token: PW, body: { from: 2, to: 1 } });

    check("a merge fills the survivor's gaps from the row going away",
      (function(){
        const r2 = rows(db, "SELECT type, manu, model, h, inv, opened FROM coasters WHERE id = 1")[0];
        return r2.manu === "B&M" && r2.model === "Invert" && r2.h === 105 && r2.inv === 5
            && r2.opened === "2008-04-18";
      })(), JSON.stringify(rows(db, "SELECT * FROM coasters WHERE id = 1")[0]));
    check("...without touching anything it already said about itself",
      rows(db, "SELECT name, park, type FROM coasters WHERE id = 1")[0].name === "Steel Vengeance"
      && rows(db, "SELECT type FROM coasters WHERE id = 1")[0].type === "Steel",
      JSON.stringify(rows(db, "SELECT name, park, type FROM coasters WHERE id = 1")[0]));

    check("a merge hands the category membership to the survivor",
      rows(db, "SELECT coaster FROM clone_members").map((r) => r.coaster).join() === "1",
      JSON.stringify(rows(db, "SELECT * FROM clone_members")));
    check("...and the ranking that held it, at the position it held",
      rows(db, "SELECT pos FROM rankings WHERE user_slug='carter' AND coaster_id=1")
        .map((r) => r.pos).join() === "1",
      JSON.stringify(rows(db, "SELECT * FROM rankings")));
    // Cole had ranked both. One row survives — his own, at his own position —
    // rather than the merge failing on the primary key or ranking it twice.
    check("...and a rider who ranked both keeps one row, not two",
      rows(db, "SELECT pos FROM rankings WHERE user_slug='cole'").map((r) => r.pos).join() === "2",
      JSON.stringify(rows(db, "SELECT * FROM rankings WHERE user_slug='cole'")));
    check("nothing anywhere still names the merged-away id",
      rows(db, "SELECT coaster_id AS c FROM rankings WHERE coaster_id=2 " +
               "UNION ALL SELECT coaster FROM clone_members WHERE coaster=2 " +
               "UNION ALL SELECT coaster FROM rider_category_members WHERE coaster=2 " +
               "UNION ALL SELECT coaster FROM category_skipped WHERE coaster=2").length === 0);
    check("...and the rider's own category came with it",
      rows(db, "SELECT coaster FROM rider_category_members").map((r) => r.coaster).join() === "1");
    check("...as did the set-aside decision",
      rows(db, "SELECT coaster FROM category_skipped").map((r) => r.coaster).join() === "1");

    // The ids reach `activity` as numbers whatever the caller sent, because a
    // repair has to find the survivor by reading that row back, and
    // json_extract returns text for a string — which SQLite will not compare
    // equal to an integer id. This is what made an earlier merge
    // unrecoverable.
    {
      const db2 = freshDb();
      await call(db2, "POST", "/api/merge", { token: PW, body: { from: "3", to: "1" } });
      const e = rows(db2, "SELECT detail FROM activity WHERE kind='coaster_merged' ORDER BY id DESC")[0];
      const d = JSON.parse(e.detail);
      check("a merge records its ids as numbers, whatever it was sent",
        d.from === 3 && d.to === 1, e.detail);
      const r2 = await call(db2, "POST", "/api/merge", { token: PW, body: { from: "x", to: 1 } });
      check("...and a non-numeric id is a 400", r2.status === 400, r2.status + "");
    }

    // A database that has not run the category migrations still merges: the
    // tables it carries are moved and the missing ones are simply not there.
    const old = dbWithoutClones();
    const r = await call(old, "POST", "/api/merge", { token: PW, body: { from: 2, to: 1 } });
    check("a merge still works before the category migrations", r.status === 200,
      r.status + " " + JSON.stringify(r.data));
    check("...and still moved the rides", rows(old, "SELECT id FROM rides WHERE coaster_id=2").length === 0);
  }

  // ---- models ---------------------------------------------------------------
  {
    const db = freshDb();
    db.exec(`
      INSERT INTO coasters (id,name,park,type,manu,model) VALUES
        (41,'Mind Eraser','Elitch Gardens','Steel','Vekoma','SLC'),
        (42,'Kong','Six Flags Discovery Kingdom','Steel','Vekoma','SLC'),
        (43,'T3','Kentucky Kingdom','Steel','Vekoma','Suspended Looping Coaster'),
        (44,'Nameless','Somewhere','Steel','Maker',NULL);
    `);
    const cookie = await signedUp(db, "models@example.com", "Mo");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "GET", "/api/admin/models", { cookie });
    const slc = r.data.models.filter((m) => m.model === "SLC")[0];
    check("lists each model with a count", r.status === 200 && slc && slc.n === 2,
      JSON.stringify(r.data.models));
    // The three fixture coasters have no model either, so this is 4 and not 1 —
    // which is the point of the number: it is the size of the job.
    check("...and counts the ones with no model at all", r.data.blank === 4,
      JSON.stringify(r.data.blank));

    r = await call(db, "POST", "/api/admin/models/rename",
      { cookie, body: { from: "SLC", to: "Suspended Looping Coaster" } });
    check("merging into a model that exists says so",
      r.status === 200 && r.data.merged === true && r.data.moved === 2 && r.data.total === 3,
      JSON.stringify(r.data));
    check("...and every coaster moved",
      rows(db, "SELECT id FROM coasters WHERE model = 'Suspended Looping Coaster'").length === 3);

    r = await call(db, "POST", "/api/admin/models/rename",
      { cookie, body: { from: "Suspended Looping Coaster", to: "Vekoma SLC" } });
    check("renaming to a name nobody uses is a rename, not a merge",
      r.status === 200 && r.data.merged === false && r.data.moved === 3, JSON.stringify(r.data));

    r = await call(db, "POST", "/api/admin/models/rename", { cookie, body: { from: "Ghost", to: "X" } });
    check("a model nobody carries is a 404", r.status === 404);
    r = await call(db, "POST", "/api/admin/models/rename", { cookie, body: { from: "Vekoma SLC", to: "" } });
    check("a model still needs a name", r.status === 400);
    r = await call(db, "POST", "/api/admin/models/rename",
      { cookie, body: { from: "Vekoma SLC", to: "Vekoma SLC" } });
    check("renaming it to itself is refused rather than silently doing nothing", r.status === 400);

    r = await call(db, "GET", "/api/admin/models");
    check("the model list needs an admin", r.status === 401, r.status + "");
  }

  // ---- moving individual rides between models -------------------------------
  //
  // The other half of the tidying: a rename takes every carrier of a name, this
  // takes the ones that were ticked. It is what /edit's model pane moves rides
  // with, and what splitting a model by maker is built out of.
  {
    const db = freshDb();
    db.exec(`
      INSERT INTO coasters (id,name,park,manu,model) VALUES
        (61,'Loop A','P','Arrow Dynamics','Looper'),
        (62,'Loop B','P','Arrow Dynamics','Looper'),
        (63,'Loop C','P','Vekoma','Looper'),
        (64,'Bare','P','Vekoma',NULL);
    `);
    const cookie = await signedUp(db, "assign@example.com", "As");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [61, 62], model: "Arrow Looper" } });
    check("moving rides onto a new model says it is new",
      r.status === 200 && r.data.moved === 2 && r.data.created === true, JSON.stringify(r.data));
    check("...and only those rides moved",
      rows(db, "SELECT id FROM coasters WHERE model = 'Looper'").map((x) => x.id).join() === "63");

    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [64], model: "Arrow Looper" } });
    check("moving onto a model that exists counts them all",
      r.status === 200 && r.data.moved === 1 && r.data.created === false && r.data.total === 3,
      JSON.stringify(r.data));

    // Ticking a ride that already carries the model is the normal way to use a
    // list of them, so it is not an error — and it is not a move either.
    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [61], model: "Arrow Looper" } });
    check("a ride that already carries it is not counted as moved",
      r.status === 200 && r.data.moved === 0, JSON.stringify(r.data));
    check("...and no feed row is written for a no-op",
      rows(db, "SELECT id FROM activity WHERE kind = 'model_assigned'").length === 2,
      JSON.stringify(rows(db, "SELECT kind, subject, n FROM activity WHERE kind = 'model_assigned'")));

    // An empty model is a real answer, and it has to be asked for: /edit once
    // posted the name under the wrong key and this took the model off thirteen
    // coasters while reporting a successful split.
    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [61], to: "Arrow Looper" } });
    check("a model under the wrong key is refused, not read as a wipe", r.status === 400,
      r.status + " " + JSON.stringify(r.data));
    check("...and nothing moved",
      rows(db, "SELECT id FROM coasters WHERE model = 'Arrow Looper'").length === 3);
    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [61], model: "", clear: true } });
    check("asking for it takes the model off, and stores NULL rather than ''",
      r.status === 200 && r.data.moved === 1
      && rows(db, "SELECT id FROM coasters WHERE model IS NULL").some((x) => x.id === 61),
      JSON.stringify(r.data));

    // The maker rides in on the same call: these rows are missing both, and
    // Carter fills both in one pass.
    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [63], model: "Vekoma Looper", manu: "Vekoma Rides" } });
    check("a maker can be written with the model",
      r.status === 200 && r.data.manu === "Vekoma Rides"
      && rows(db, "SELECT manu, model FROM coasters WHERE id = 63")[0].manu === "Vekoma Rides",
      JSON.stringify(rows(db, "SELECT manu, model FROM coasters WHERE id = 63")));
    // An empty maker box says nothing about the maker; it does not erase one.
    r = await call(db, "POST", "/api/admin/models/assign",
      { cookie, body: { ids: [63], model: "Vekoma Looper", manu: "" } });
    check("...and an empty maker leaves the one it had",
      rows(db, "SELECT manu FROM coasters WHERE id = 63")[0].manu === "Vekoma Rides");

    r = await call(db, "POST", "/api/admin/models/assign", { cookie, body: { ids: [], model: "X" } });
    check("no coasters is a 400", r.status === 400);
    r = await call(db, "POST", "/api/admin/models/assign", { body: { ids: [61], model: "X" } });
    check("moving rides between models needs an admin", r.status === 401);
  }

  // ---- the models queue's set-aside ----------------------------------------
  {
    const db = freshDb();
    db.exec(MIGRATION_017);
    db.exec(MIGRATION_017);
    const cookie = await signedUp(db, "mtriage@example.com", "Mt");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "POST", "/api/admin/models/skipped", { cookie, body: { ids: [1, 2] } });
    check("setting rides aside", r.status === 200 && r.data.on === true);
    r = await call(db, "GET", "/api/admin/models/skipped", { cookie });
    check("...and reading them back", r.data.ids.sort().join() === "1,2", JSON.stringify(r.data));
    r = await call(db, "POST", "/api/admin/models/skipped", { cookie, body: { ids: [1], on: false } });
    r = await call(db, "GET", "/api/admin/models/skipped", { cookie });
    check("...putting one back leaves the other", r.data.ids.join() === "2", JSON.stringify(r.data));
    r = await call(db, "GET", "/api/admin/models/skipped");
    check("the models queue needs an admin", r.status === 401);

    // Before the migration: the read answers, the write names the file.
    const old = freshDb();
    const c2 = await signedUp(old, "pre17@example.com", "Pre");
    old.prepare("UPDATE accounts SET is_admin = 1").run();
    r = await call(old, "GET", "/api/admin/models/skipped", { cookie: c2 });
    check("no migration yet: the read is empty, not an error",
      r.status === 200 && r.data.ids.length === 0 && /017/.test(r.data.need || ""),
      JSON.stringify(r.data));
    r = await call(old, "POST", "/api/admin/models/skipped", { cookie: c2, body: { ids: [1] } });
    check("no migration yet: the write is a 503 naming the file",
      r.status === 503 && /017-model-triage\.sql/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));
  }

  // ---- curation stays out of the feed ---------------------------------------
  //
  // Renaming a model, moving rides between models, building or deleting a
  // category: recorded, and not published. A tidying session is dozens of them
  // and they buried what /changes is for. (Carter, 2026-09-20.)
  {
    const db = freshDb();
    const cookie = await signedUp(db, "feed@example.com", "Fe");
    db.prepare("UPDATE accounts SET is_admin = 1").run();
    await call(db, "POST", "/api/admin/models/assign", { cookie, body: { ids: [1], model: "Hyper" } });
    await call(db, "POST", "/api/admin/models/rename", { cookie, body: { from: "Hyper", to: "Giga" } });
    await call(db, "POST", "/api/clones", { cookie, body: { name: "Twins", ids: [1, 2] } });

    check("all of it is recorded",
      rows(db, "SELECT kind FROM activity WHERE kind IN ('model_assigned','model_renamed','clone_set')")
        .length === 3);
    const r = await call(db, "GET", "/api/activity");
    check("...and none of it reaches the feed",
      !r.data.events.some((e) => /^clone_|^model_/.test(e.kind)),
      JSON.stringify(r.data.events.map((e) => e.kind)));
    check("...while what the feed is for still does",
      r.data.events.length > 0 && r.data.events.every((e) => e.kind === "user_added"),
      JSON.stringify(r.data.events.map((e) => e.kind)));
  }

  // The window where the code is live and 013 is not.
  {
    const db = dbWithoutRiderCats();
    let r = await call(db, "GET", "/api/categories/carter");
    check("no migration yet: the read still answers",
      r.status === 200 && Array.isArray(r.data.categories) && r.data.on === true,
      r.status + " " + JSON.stringify(r.data));
    const cookie = await signedUp(db, "pre13@example.com", "Prethirteen");
    const slug = db.prepare("SELECT slug FROM accounts WHERE email = 'pre13@example.com'").get().slug;
    r = await call(db, "POST", "/api/categories/" + slug, { cookie, body: { name: "X", ids: [1, 2] } });
    check("no migration yet: a write is a 503 naming the file",
      r.status === 503 && /013-rider-categories\.sql/.test(r.data.error || ""),
      r.status + " " + JSON.stringify(r.data));
  }

  // ---- renaming a park, and the former name that keeps its URL alive --------
  //
  // The point of these is not the UPDATE, it is park_aliases: /park/<park> and
  // /park/<park>/<coaster> resolve through that table (findPark/findCoaster in
  // app.js), so a rename that forgets to write it silently breaks every link
  // anyone has ever shared to that park.
  {
    const db = freshDb();
    db.exec(`
      INSERT INTO parks (name,lat,lon,region) VALUES
        ('Old Name', 1.5, 2.5, 'Ohio, US'),
        ('Has Gaps', NULL, NULL, NULL);
      INSERT INTO coasters (id,name,park,type) VALUES
        (51,'Racer','Old Name','Wood'),
        (52,'Blue Streak','Old Name','Wood'),
        (53,'Orphan','Nowhere In Parks','Steel'),
        (54,'Gapper','Has Gaps','Steel');
      INSERT INTO park_aliases (park, former_name) VALUES ('Old Name','Older Name');
    `);
    const cookie = await signedUp(db, "parks@example.com", "Parker");
    db.prepare("UPDATE accounts SET is_admin = 1").run();

    let r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "Old Name", to: "New Name" } });
    check("a park rename moves every coaster standing in it",
      r.status === 200 && r.data.merged === false && r.data.moved === 2, JSON.stringify(r.data));
    check("...and the coasters carry the new name",
      rows(db, "SELECT id FROM coasters WHERE park = 'New Name'").length === 2);
    check("...and the parks row moved with its coordinates",
      rows(db, "SELECT lat FROM parks WHERE name = 'New Name'")[0]?.lat === 1.5
      && rows(db, "SELECT name FROM parks WHERE name = 'Old Name'").length === 0);
    check("...and the old name is recorded as a former name",
      rows(db, "SELECT 1 FROM park_aliases WHERE park = 'New Name' AND former_name = 'Old Name'").length === 1);
    // An alias pointing at a park that no longer exists is a dead end, so the
    // ones the old name answered to have to come along.
    check("...and the aliases it already had came with it",
      rows(db, "SELECT 1 FROM park_aliases WHERE park = 'New Name' AND former_name = 'Older Name'").length === 1
      && rows(db, "SELECT 1 FROM park_aliases WHERE park = 'Old Name'").length === 0);

    // A -> B -> A: "New Name" must stop being a former name of itself, or /add
    // answers "that is the old name" about the name it currently has.
    r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "New Name", to: "Old Name" } });
    check("renaming back does not leave a park aliased to itself",
      r.status === 200
      && rows(db, "SELECT 1 FROM park_aliases WHERE park = former_name").length === 0,
      JSON.stringify(rows(db, "SELECT * FROM park_aliases")));
    check("...and renaming back is not a merge", r.data.merged === false, JSON.stringify(r.data));

    // A park that is only a name on coasters, with no row in `parks`.
    r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "Nowhere In Parks", to: "Somewhere Real" } });
    check("a park with no parks row is still renameable",
      r.status === 200 && r.data.moved === 1
      && rows(db, "SELECT 1 FROM coasters WHERE park = 'Somewhere Real'").length === 1,
      JSON.stringify(r.data));

    // Merging: two spellings of one place, which is what this is mostly for.
    r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "Somewhere Real", to: "Old Name" } });
    check("renaming onto a park that exists is a merge, and says so",
      r.status === 200 && r.data.merged === true && r.data.total === 3, JSON.stringify(r.data));
    check("...and only one parks row survives",
      rows(db, "SELECT name FROM parks WHERE name IN ('Old Name','Somewhere Real')").length === 1);

    // The surviving row may be the one that never got geocoded.
    r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "Old Name", to: "Has Gaps" } });
    check("a merge fills the survivor's gaps from the row going away",
      r.status === 200 && rows(db, "SELECT lat, region FROM parks WHERE name = 'Has Gaps'")[0]?.lat === 1.5
      && rows(db, "SELECT region FROM parks WHERE name = 'Has Gaps'")[0]?.region === "Ohio, US",
      JSON.stringify(rows(db, "SELECT * FROM parks")));

    r = await call(db, "POST", "/api/admin/parks/rename", { cookie, body: { from: "Ghost Park", to: "X" } });
    check("a park nobody has heard of is a 404", r.status === 404);
    r = await call(db, "POST", "/api/admin/parks/rename", { cookie, body: { from: "Has Gaps", to: "" } });
    check("a park still needs a name", r.status === 400);
    r = await call(db, "POST", "/api/admin/parks/rename",
      { cookie, body: { from: "Has Gaps", to: "Has Gaps" } });
    check("renaming a park to itself is refused", r.status === 400);
    r = await call(db, "POST", "/api/admin/parks/rename", { body: { from: "Has Gaps", to: "Y" } });
    check("renaming a park needs an admin", r.status === 401, r.status + "");

    // No duplicate rows, whatever route the renames above took.
    check("no duplicate aliases anywhere",
      rows(db, "SELECT park, former_name, COUNT(*) AS n FROM park_aliases " +
               "GROUP BY park, former_name HAVING n > 1").length === 0,
      JSON.stringify(rows(db, "SELECT * FROM park_aliases")));
  }

  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
