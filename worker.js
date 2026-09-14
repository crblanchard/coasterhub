// Coaster Hub — Worker entrypoint.
// Serves the static site (via the ASSETS binding) and a small JSON API backed
// by a D1 database (binding: DB). The API is additive and DEFENSIVE: if D1 is
// not bound yet, every /api/* route returns 503 and the static site still works
// exactly as before.
//
// Reads are public. Writes come in two kinds:
//   - a rider's own rides and rankings, authorized by their ACCOUNT (see the
//     Accounts section below, and migrations/003-accounts.sql);
//   - everything shared — the coaster and park database, merges, imports —
//     which still needs ADMIN_PASSWORD.
// ADMIN_PASSWORD also opens the first kind, so it stays the break-glass key and
// the riders who have not claimed an account yet keep working exactly as before.
//
// Bindings (see wrangler.jsonc):
//   ASSETS  - static assets (the repo files)
//   DB      - D1 database "coasterhub"
//   ADMIN_PASSWORD - secret; required for shared-database writes + /api/admin/*

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function err(status, message) { return json({ error: message }, status); }

// After a successful D1 write, nudge GitHub to re-sync the static JSON snapshot
// (coasters.json / parks.json / <rider>.json) so the pages that read those files
// directly stay in step with the live data. Fire-and-forget via ctx.waitUntil so
// it never slows down or blocks the edit. No-op until a GITHUB_TOKEN secret (a
// fine-grained PAT with Contents: write on this repo) is configured; the Actions
// side debounces a burst of edits into a single commit.
function afterWrite(ctx, env, response) {
  ctx.waitUntil(dispatchSync(env));
  return response;
}
async function dispatchSync(env) {
  if (!env.GITHUB_TOKEN) return;
  try {
    await fetch("https://api.github.com/repos/crblanchard/coasterhub/dispatches", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.GITHUB_TOKEN,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "coasterhub-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "edit" }),
    });
  } catch (e) { /* best-effort; never let a sync hiccup break an edit */ }
}

// Constant-time-ish equality for the admin token.
function tokenOk(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const hdr = request.headers.get("x-admin-token") || "";
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ch_admin=([^;]+)/);
  const supplied = hdr || (cookie ? decodeURIComponent(cookie[1]) : "");
  if (supplied.length !== env.ADMIN_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ env.ADMIN_PASSWORD.charCodeAt(i);
  return diff === 0;
}

// ---- Accounts -------------------------------------------------------------
// ADMIN_PASSWORD above is still the break-glass key and still opens everything.
// What accounts add is *identity*: a session says which rider you are, so the
// ride and ranking routes can refuse a write into someone else's count. See
// migrations/003-accounts.sql for the tables.
//
// Hashing is PBKDF2-HMAC-SHA256 via WebCrypto — the only KDF the Workers runtime
// offers without shipping wasm. The iteration count is stored *in* the hash, so
// changing it later re-hashes people on their next sign-in instead of locking
// them out.
//
// 100000 is the CEILING, not a preference: the Workers runtime rejects anything
// above it outright ("iteration counts above 100000 are not supported"), which
// is below OWASP's current advice for this algorithm. Node's WebCrypto has no
// such limit, so a local test will happily accept a number production refuses —
// this shipped at 210000 and failed on the first real sign-up. The test suite
// now asserts the ceiling. If stronger hashing is wanted, it needs a different
// KDF (scrypt/argon2 via wasm), not a bigger number here.
const PBKDF2_MAX_ITERS = 100000;
const PBKDF2_ITERS = PBKDF2_MAX_ITERS;
const SESSION_DAYS = 90;
const COOKIE = "ch_sess";

const enc = new TextEncoder();
function b64(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function hex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }

// Same shape as tokenOk's compare: length first, then every byte, so a wrong
// password takes the same time whether it differs in the first character or the
// last.
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(pw, saltIn, itersIn) {
  const salt = saltIn || crypto.getRandomValues(new Uint8Array(16));
  const iters = itersIn || PBKDF2_ITERS;
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters }, key, 256);
  return "pbkdf2$sha256$" + iters + "$" + b64(salt) + "$" + b64(new Uint8Array(bits));
}
async function verifyPassword(pw, stored) {
  const p = String(stored || "").split("$");
  if (p.length !== 5 || p[0] !== "pbkdf2" || p[1] !== "sha256") return false;
  const iters = Number(p[2]);
  // Bound the stored count: a corrupted row saying 10 iterations must not
  // silently downgrade the check, and one above the runtime ceiling would throw
  // rather than return — a 500 on the login route instead of a clean "no".
  if (!Number.isInteger(iters) || iters < 10000 || iters > PBKDF2_MAX_ITERS) return false;
  let salt;
  try { salt = unb64(p[3]); } catch (e) { return false; }
  try {
    return sameString(await hashPassword(pw, salt, iters), stored);
  } catch (e) { return false; }
}

// A real hash of a throwaway string, so signing in with an unknown email can do
// the same PBKDF2 work as a known one. Without it, "no such account" returns in
// microseconds and "wrong password" in ~100ms, which is a readable answer to
// "does this person have an account here?".
const DUMMY_HASH = "pbkdf2$sha256$100000$H9X3LabUcAffgcYCyj1o0g==$7sAIfFxqCdYJxURiUnrHT7zP+kFgAnGW0eMX7uxJpAo=";

// Has migrations/003-accounts.sql been applied?
//
// This matters because a push to main deploys the Worker immediately while the
// migration is run by hand: for the window between the two, `accounts` does not
// exist. Every account-aware path asks this first and degrades to exactly the
// old behaviour — the shared password — rather than throwing "no such table"
// into a rankings save. Same defensiveness as the unbound-D1 case above.
// Deliberately NOT cached per isolate. A cached "yes" would outlive the thing it
// describes — a rolled-back database, a test that drops the table — and the
// saving is one trivial query on paths that are already doing a write or a
// password hash. The public read paths never call this at all.
async function haveAccounts(env) {
  try {
    await env.DB.prepare("SELECT 1 FROM accounts LIMIT 1").first();
    return true;
  } catch (e) { return false; }
}

function randomToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
async function sha256hex(s) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

// The cookie holds the raw token; the table holds its SHA-256. A dump of
// `sessions` therefore cannot be replayed as a login — the same reason the
// password column holds a hash.
async function startSession(env, accountId) {
  const raw = randomToken();
  const now = new Date();
  await env.DB.prepare("INSERT INTO sessions (token,account,created,expires) VALUES (?,?,?,?)")
    .bind(await sha256hex(raw), accountId, now.toISOString(),
          new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString()).run();
  return raw;
}
// Secure is unconditional: the Worker 301s http to https before any route runs,
// so there is no plaintext context left for the cookie to be useful in.
function setCookie(raw) {
  return COOKIE + "=" + raw + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    (SESSION_DAYS * 86400);
}
function clearCookie() {
  return COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
function cookieToken(request) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ch_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Who is signed in, or null. Resolved once per request in fetch() and passed
// around: every call costs a SHA-256 and a join, and the write routes would
// otherwise each redo it.
async function currentAccount(request, env) {
  const raw = cookieToken(request);
  if (!raw) return null;
  if (!await haveAccounts(env)) return null;
  const row = await env.DB.prepare(
    "SELECT a.id AS id, a.email AS email, a.slug AS slug, a.is_admin AS adm, " +
    "u.name AS name, s.expires AS expires FROM sessions s " +
    "JOIN accounts a ON a.id = s.account LEFT JOIN users u ON u.slug = a.slug " +
    "WHERE s.token = ?"
  ).bind(await sha256hex(raw)).first();
  if (!row) return null;
  if (!(new Date(row.expires) > new Date())) {
    // Expired: drop it now rather than leaving dead rows for a cleanup job that
    // does not exist. The cookie is cleared by whatever route noticed.
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256hex(raw)).run();
    return null;
  }
  return { id: row.id, email: row.email, slug: row.slug, name: row.name, admin: !!row.adm };
}

// May this request write to <slug>'s rides or rankings?
//
// Three ways in, in the order they are cheapest to check: the shared admin
// password, an account flagged admin, or the account that owns that very rider.
// Anything else is a 401 — including a signed-in rider aiming at someone else's
// count, which is precisely the hole accounts were added to close.
function mayWriteRider(request, env, slug, acct) {
  if (tokenOk(request, env)) return true;
  if (!acct) return false;
  if (acct.admin) return true;
  return !!slug && !!acct.slug && acct.slug === String(slug).toLowerCase();
}

function emailOk(s) {
  return typeof s === "string" && s.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}
// Length only. A composition rule ("one number, one symbol") mostly teaches
// people to write Password1! — a floor of 8 with no ceiling below 200 is the
// current NIST advice and is what the sign-up copy promises.
function passwordProblem(s) {
  if (typeof s !== "string" || s.length < 8) return "pick a password of at least 8 characters";
  if (s.length > 200) return "that password is too long";
  return null;
}

// Columns on the coasters table, in order (id is managed separately).
const COASTER_FIELDS = ["name","park","type","manu","model","h","s","l","inv","dur","laps","yr","opened","openedPrec","closed","closedPrec"];

// ---- Row <-> API shape helpers -------------------------------------------
function coasterRow(r) {
  const o = { id: r.id };
  for (const f of COASTER_FIELDS) o[f] = r[f] === undefined ? null : r[f];
  return o;
}

async function getCoasters(env) {
  const { results } = await env.DB.prepare("SELECT * FROM coasters ORDER BY id").all();
  return results.map(coasterRow);
}
// Former names, so a rename or a retheme doesn't read as a missing coaster.
// Someone typing "Intimidator" at Carowinds should land on Thunder Striker
// rather than create a second row — no string matcher bridges a retheme, which
// is how most of this table's duplicates got in.
async function getAliases(env) {
  const [c, p] = await Promise.all([
    env.DB.prepare("SELECT coaster_id, former_name FROM coaster_aliases").all(),
    env.DB.prepare("SELECT park, former_name FROM park_aliases").all(),
  ]);
  return {
    aliases: c.results.map(r => ({ c: r.coaster_id, n: r.former_name })),
    parkAliases: p.results.map(r => ({ p: r.park, n: r.former_name })),
  };
}

// Record a former name whenever one stops being current. Called on rename and on
// merge, so the table maintains itself — every alias below the backfill was
// reconstructed by hand from git history, which is not repeatable.
function recordAlias(env, id, formerName, note) {
  if (!formerName) return null;
  return env.DB.prepare(
    "INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) " +
    "SELECT ?, ?, ?, date('now') WHERE NOT EXISTS " +
    "(SELECT 1 FROM coasters WHERE id = ? AND name = ?)"   // never alias a name to itself
  ).bind(id, formerName, note, id, formerName);
}

async function getParks(env) {
  const { results } = await env.DB.prepare("SELECT * FROM parks").all();
  const out = {};
  for (const p of results) out[p.name] = { lat: p.lat, lon: p.lon, region: p.region };
  return out;
}
async function getUser(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare("SELECT coaster_id, d FROM rides WHERE user_slug = ? ORDER BY id").bind(slug).all();
  return { user: u.name, rides: results.map(x => ({ c: x.coaster_id, d: x.d })) };
}

// ---- Riders ---------------------------------------------------------------
// The rider list lives in D1, not only in the USERS array in app.js, so someone
// added on /log or /import can be picked and written to straight away instead of
// waiting for a deploy. app.js still ships USERS as the offline fallback.
async function getUsers(env) {
  const { results } = await env.DB.prepare("SELECT slug, name FROM users ORDER BY name").all();
  return results.map(u => ({ slug: u.slug, name: u.name }));
}

// The slug IS the URL (/user/<slug>/stats), so it is derived tightly and the
// page names are refused — a rider called "Stats" would shadow a real page.
const RESERVED_SLUGS = new Set(["api","user","users","admin","new","all","everyone",
  "home","stats","rides","rankings","coasters","parks","log","add","edit","import",
  "changes","database","sitemap","index","account","accounts","login","logout",
  "signup","signin","profile","me","auth","session","settings"]);
function slugify(s) {
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function addUser(env, body) {
  const name = String(body && body.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { bad: [400, "give the rider a name"] };
  if (name.length > 40) return { bad: [400, "that name is too long"] };
  const slug = slugify(body && body.slug || name);
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(slug)) {
    return { bad: [400, "that name needs at least two letters or numbers"] };
  }
  if (RESERVED_SLUGS.has(slug)) return { bad: [400, "“" + slug + "” is a page name — pick another"] };
  const clash = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(slug).first();
  if (clash) return { bad: [409, clash.name + " is already here (/user/" + slug + ")"] };
  // mode is 'rides' for everyone since the 2026-07-29 migration; nothing branches
  // on it any more, but the column is still NOT NULL-ish in spirit, so set it.
  await env.DB.prepare(
    "INSERT INTO users (slug,name,mode,email,created) VALUES (?,?,'rides',NULL,datetime('now'))"
  ).bind(slug, name).run();
  await recordActivity(env, "user_added", { actor: slug, subject: name });
  return { ok: true, slug: slug, name: name };
}

// ---- Renaming a rider ------------------------------------------------------
// See migrations/004-user-rename.sql. `slug` is a public URL and a key in five
// other tables; `name` is free text nobody joins on. So they validate
// differently and only one of them is hard to change.

// Is this username free?
async function slugProblem(env, slug, selfSlug) {
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(slug)) {
    return "a username needs 2-32 characters, letters, numbers or hyphens";
  }
  if (RESERVED_SLUGS.has(slug)) return "“" + slug + "” is a page name — pick another";
  if (slug === selfSlug) return null;
  const clash = await env.DB.prepare("SELECT name FROM users WHERE slug = ?").bind(slug).first();
  if (clash) return "“" + slug + "” is taken";
  return null;
}

// The rename. Every table that stores a slug moves together, in one batch,
// because a half-applied rename would detach a rider from their own rides.
//
// It is a MOVE, not a forward: the old username is gone the moment this
// returns, and /user/<old>/ 404s rather than redirecting. Carter's call,
// 2026-09-14, having seen the alternative — the first cut kept a `user_aliases`
// row so old links survived, and he wanted the old id genuinely gone. The
// consequences are the ones you would expect and are the point, not a bug: a
// link someone saved last year breaks, and the freed name can be taken by
// anyone, inheriting nothing except the name itself.
async function renameRider(env, from, to) {
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET slug = ? WHERE slug = ?").bind(to, from),
    env.DB.prepare("UPDATE rides SET user_slug = ? WHERE user_slug = ?").bind(to, from),
    env.DB.prepare("UPDATE rankings SET user_slug = ? WHERE user_slug = ?").bind(to, from),
    env.DB.prepare("UPDATE accounts SET slug = ? WHERE slug = ?").bind(to, from),
    env.DB.prepare("UPDATE activity SET actor = ? WHERE actor = ?").bind(to, from),
    env.DB.prepare("UPDATE invites SET slug = ? WHERE slug = ?").bind(to, from),
  ]);
  await recordActivity(env, "user_renamed", { actor: to, subject: from });
}

// ---- Ride log -------------------------------------------------------------
// One shape for every rider:  { user, rides:[{ i, c, d }] }
// One row per ride, each with the row id so an individual mis-tapped ride can
// be deleted, and `d` null when the date is not known. Undated rows sort last:
// they are still credits, they just have no place on a calendar.
async function getRides(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare(
    "SELECT id, coaster_id, d FROM rides WHERE user_slug = ? ORDER BY d IS NULL, d, id"
  ).bind(slug).all();
  return { user: u.name, rides: results.map(x => ({ i: x.id, c: x.coaster_id, d: x.d })) };
}

// D1 caps bound parameters per statement (SQLITE_MAX_VARIABLE_NUMBER, ~100), so
// any "WHERE id IN (?,?,…)" built from a user's list has to be asked in chunks.
// Both callers below are list-shaped and unbounded in practice — a pasted import
// or a ranking past 100 rides — and an unchunked lookup fails the whole write
// with "too many SQL variables" rather than degrading.
const SQL_VARS = 90;
async function knownCoasterIds(env, ids) {
  const known = new Set();
  for (let i = 0; i < ids.length; i += SQL_VARS) {
    const part = ids.slice(i, i + SQL_VARS);
    const { results } = await env.DB.prepare(
      "SELECT id FROM coasters WHERE id IN (" + part.map(() => "?").join(",") + ")"
    ).bind(...part).all();
    for (const r of results) known.add(r.id);
  }
  return known;
}

// Credits are the headline number (distinct coasters); rides counts the laps.
async function userTotal(env, slug) {
  const t = await env.DB.prepare(
    "SELECT COUNT(DISTINCT coaster_id) AS credits, COUNT(*) AS rides FROM rides WHERE user_slug = ?"
  ).bind(slug).first();
  return t ? { credits: t.credits, rides: t.rides } : { credits: 0, rides: 0 };
}

// Add rides in one batch: { user, d:"YYYY-MM-DD"|null, entries:[{c,n}] }.
//
// Two ways in, one write path. A park day carries a date and a lap count per
// coaster. A list built from memory carries neither: d is null and every entry
// is a single row, because "I have ridden this" is one ride's worth of fact.
// Passing d null is therefore explicit, not a missing field — see the null
// check below, which distinguishes "no date given" from "bad date given".
//
// EVERY coaster id is validated up front and the whole batch is rejected if any
// is unknown — a typo must never half-log a day. Returns {added, total, date}.
async function addRides(env, b) {
  const slug = String(b && b.user || "").toLowerCase();
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [400, "no such user"] };

  // null/absent d = undated. Anything else must be a real date; a malformed
  // string is a bug worth surfacing, not something to silently treat as blank.
  const d = (b && b.d != null && b.d !== "") ? String(b.d) : null;
  if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { bad: [400, "need d as YYYY-MM-DD or null"] };

  const entries = Array.isArray(b && b.entries) ? b.entries : [];
  if (!entries.length) return { bad: [400, "no entries"] };

  const norm = [];
  for (const e of entries) {
    const c = Number(e && e.c);
    if (!Number.isInteger(c) || c <= 0) return { bad: [400, "bad coaster id"] };
    let n = Math.round(Number(e && e.n));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 50) n = 50;                       // laps clamp: a typo can't insert 5000 rows
    norm.push({ c: c, n: n });
  }

  const ids = [...new Set(norm.map(e => e.c))];
  const known = await knownCoasterIds(env, ids);
  const unknown = ids.filter(i => !known.has(i));
  if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };

  const batch = [];
  // One row per lap, so each ride stays individually deletable.
  //
  // An undated entry is only inserted if that coaster has no undated row yet:
  // ticking the same coaster off a list twice means "yes, I have ridden it",
  // not "I rode it twice". Dated rides have no such guard — riding something
  // twice on one day is a real thing to record.
  for (const e of norm) {
    if (d === null) {
      // Laps are unknown, so an undated entry is a single row — and only if
      // the rider has NO row for that coaster yet. "I have ridden this" adds
      // nothing when we already know they have, whether from a logged day or
      // an earlier pass through the list, and inserting anyway would inflate
      // their ride count with a ride that never happened.
      batch.push(env.DB.prepare(
        "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,NULL WHERE NOT EXISTS " +
        "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
      ).bind(slug, e.c, slug, e.c));
    } else {
      for (let k = 0; k < e.n; k++) {
        batch.push(env.DB.prepare("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)").bind(slug, e.c, d));
      }
    }
  }

  // Credits before the write, so the feed can say how many of these were new
  // to the rider rather than re-rides. Has to be read first — afterwards the
  // difference is unrecoverable.
  const wasCredits = (await userTotal(env, slug)).credits;

  // Count what the database actually wrote rather than what was asked for —
  // the undated guard skips coasters the rider already has, so "added 12" has
  // to mean twelve rows, not twelve ticks.
  const CHUNK = 90;                            // D1 caps statements per batch call
  let inserted = 0;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const res = await env.DB.batch(batch.slice(i, i + CHUNK));
    for (const r of res) inserted += (r.meta && r.meta.changes) || 0;
  }

  const total = await userTotal(env, slug);
  if (inserted) {
    await recordActivity(env, d === null ? "credits" : "rides", {
      actor: slug,
      subject: d === null ? null : await parkLabel(env, ids),
      n: inserted,
      detail: { rides: inserted, coasters: norm.length,
                newCredits: total.credits - wasCredits, date: d },
    });
  }
  return {
    added: inserted,
    coasters: norm.length,
    total: total.rides,
    credits: total.credits,
    date: d,
  };
}

// ---- Activity feed --------------------------------------------------------
// A plain record of what changed, so five people sharing one password can see
// each other's work. There are no accounts here and this is not an audit log:
// `actor` is whoever the request already identified — the rider picked on /log,
// the slug in a /rankings URL — and it is NULL for the database-editing routes,
// which carry no rider at all. Those read impersonally ("X was added") rather
// than guessing a name, because a wrong name is worse than no name.
//
// Never let this break a write: an activity row is a nice-to-have, the edit is
// not. Every call is wrapped and failures are swallowed.
async function recordActivity(env, kind, { actor = null, subject = null, n = null, detail = null } = {}) {
  try {
    await env.DB.prepare(
      "INSERT INTO activity (at, actor, kind, subject, n, detail) VALUES (?,?,?,?,?,?)"
    ).bind(new Date().toISOString(), actor, kind, subject, n,
           detail == null ? null : JSON.stringify(detail)).run();
  } catch (e) { /* the edit already succeeded; a missing feed row is not worth a 500 */ }
}

// Ranking arrives in bursts. Building a list is fifty small saves — drag one
// coaster, save, drag the next — and one row each turned the feed into a column
// of "Carter ranked 1 new coaster" with the running total ticking up beside it.
// So a ranking event MERGES into this rider's last one while that one is under
// an hour old: the counts add up, the total and the timestamp become the newest,
// and the feed carries a single line that grows as you work.
//
// The merge happens on write rather than on read because the feed is fetched
// with a LIMIT — left alone, one long session would fill the whole page and
// push everyone else's activity off it. `saves` keeps the honest count of how
// many times it was actually saved.
const RANKING_MERGE_MS = 60 * 60 * 1000;
async function recordRanking(env, slug, { added, removed, reordered, credited, total }) {
  const now = new Date().toISOString();
  try {
    const prev = await env.DB.prepare(
      "SELECT id, at, detail FROM activity WHERE kind = 'ranking' AND actor = ? ORDER BY at DESC, id DESC LIMIT 1"
    ).bind(slug).first();
    // A legacy row carrying a bare date parses to midnight and is days old, so
    // it fails this test on its own — no special case needed for it.
    if (prev && Date.parse(now) - Date.parse(prev.at) < RANKING_MERGE_MS) {
      const d = JSON.parse(prev.detail || "{}");
      const merged = {
        added: (d.added || 0) + added,
        removed: (d.removed || 0) + removed,
        reordered: !!(d.reordered || reordered),
        credited: (d.credited || 0) + (credited || 0),
        total: total,                       // the newest total, not a sum
        saves: (d.saves || 1) + 1,
      };
      await env.DB.prepare("UPDATE activity SET at = ?, n = ?, detail = ? WHERE id = ?")
        .bind(now, merged.added || merged.removed || total, JSON.stringify(merged), prev.id).run();
      return;
    }
  } catch (e) { /* fall through and just record it normally */ }
  await recordActivity(env, "ranking", {
    actor: slug, n: added || removed || total,
    detail: { added, removed, reordered, credited: credited || 0, total, saves: 1 },
  });
}

async function getActivity(env, limit) {
  const { results } = await env.DB.prepare(
    "SELECT id, at, actor, kind, subject, n, detail FROM activity ORDER BY at DESC, id DESC LIMIT ?"
  ).bind(limit).all();
  const names = await env.DB.prepare("SELECT slug, name FROM users").all();
  const by = {};
  for (const u of names.results) by[u.slug] = u.name;
  return {
    events: results.map(r => ({
      id: r.id, at: r.at, actor: r.actor, actorName: r.actor ? (by[r.actor] || r.actor) : null,
      kind: r.kind, subject: r.subject, n: r.n,
      detail: r.detail ? JSON.parse(r.detail) : null,
    })),
  };
}

// The park a batch of coasters belongs to, for "logged 5 rides at Kings Island".
// One name when they all share a park, otherwise a count — a day that spans two
// parks is real, and naming only the first would misreport it.
async function parkLabel(env, ids) {
  if (!ids.length) return null;
  const known = new Set();
  for (let i = 0; i < ids.length; i += SQL_VARS) {
    const part = ids.slice(i, i + SQL_VARS);
    const { results } = await env.DB.prepare(
      "SELECT DISTINCT park FROM coasters WHERE id IN (" + part.map(() => "?").join(",") + ")"
    ).bind(...part).all();
    for (const r of results) if (r.park) known.add(r.park);
  }
  const list = [...known];
  return list.length === 1 ? list[0] : (list.length ? list.length + " parks" : null);
}

// ---- Rankings -------------------------------------------------------------
// A rider's personal order of the coasters they've ridden, best first. Stored as
// (user, coaster, pos) with pos 1 = favourite.
//
// Writes are OPEN on purpose. Carter's call (2026-07-30): gating them made his
// own rankings page demand a password to reorder his own list, which is friction
// in exactly the wrong place — ranking is the enjoyable part of the site, and
// the people doing it are the four riders. Logging rides (/log) and adding to
// the shared coaster list (/add) stay gated, because those write data that
// everyone else's pages read.
//
// The exposure, stated plainly: anyone who finds this endpoint can PUT any
// rider's order. Nothing else is reachable through it — it touches only the
// `rankings` table, ride and credit counts are unaffected, and a scrambled order
// is repairable by dragging it back. Set this to true to gate it; the page will
// need its unlock UI back, which is in git history at c27b43b.
const RANKINGS_NEED_TOKEN = false;

async function getRankings(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare(
    "SELECT coaster_id, pos FROM rankings WHERE user_slug = ? ORDER BY pos"
  ).bind(slug).all();
  return { user: u.name, slug: slug, order: results.map(r => r.coaster_id) };
}

// Replace a rider's whole list in one shot: { order:[coasterId, ...] }. Doing it
// wholesale keeps add / remove / reorder / head-to-head insert on one code path,
// and means a half-applied reorder can't leave gaps or duplicate positions.
async function putRankings(env, slug, body) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [404, "no such user"] };

  const raw = Array.isArray(body && body.order) ? body.order : null;
  if (!raw) return { bad: [400, "need order: [coasterId, ...]"] };
  if (raw.length > 5000) return { bad: [400, "order too long"] };

  const seen = new Set(), order = [];
  for (const v of raw) {
    const id = Number(v);
    if (!Number.isInteger(id) || id <= 0) return { bad: [400, "bad coaster id: " + v] };
    if (seen.has(id)) continue;            // a coaster can only sit in one place
    seen.add(id); order.push(id);
  }

  if (order.length) {
    const known = await knownCoasterIds(env, order);
    const unknown = order.filter(i => !known.has(i));
    if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };
  }

  // Read the old order BEFORE replacing it. A PUT carries the whole list, so
  // "what changed" only exists as the difference between the two — and after
  // the DELETE below it is gone. This is what lets the feed say "ranked 20 new
  // coasters" instead of the useless "saved 562 coasters" every single time.
  const prev = await env.DB.prepare(
    "SELECT coaster_id FROM rankings WHERE user_slug = ? ORDER BY pos"
  ).bind(slug).all();
  const before = prev.results.map(r => r.coaster_id);
  const beforeSet = new Set(before);
  const added = order.filter(id => !beforeSet.has(id)).length;
  const removed = before.filter(id => !seen.has(id)).length;
  // Reordered only counts when the list is otherwise the same, so a save that
  // adds rides doesn't also claim a reshuffle it didn't really do.
  const reordered = added === 0 && removed === 0
    && before.some((id, i) => order[i] !== id);

  // The DELETE leads the batch so the replace is atomic within its chunk; the
  // inserts that follow are ordered, so a mid-way failure truncates the list
  // rather than scrambling it. Validation above is what keeps that from
  // happening for the reason it used to (an over-long IN clause).
  const batch = [env.DB.prepare("DELETE FROM rankings WHERE user_slug = ?").bind(slug)];
  order.forEach((id, i) => {
    batch.push(env.DB.prepare("INSERT INTO rankings (user_slug,coaster_id,pos) VALUES (?,?,?)")
      .bind(slug, id, i + 1));
  });
  for (let i = 0; i < batch.length; i += SQL_VARS) await env.DB.batch(batch.slice(i, i + SQL_VARS));

  // Ranking a coaster means you have ridden it, so it becomes a credit.
  //
  // Before this, the two lists could disagree: a rider could rank twenty
  // coasters and still show a count of zero, which is what a new account
  // looked like after its first session with the head-to-head. Nobody ranks a
  // ride they have not been on.
  //
  // It only ever ADDS. Un-ranking something does not delete the credit, and
  // that asymmetry is deliberate: dropping a coaster off your favourites list
  // says something about the ranking, not about whether you rode it, and a
  // reorder must never be able to destroy ride history. Removing a credit
  // stays an explicit act on /log.
  //
  // The rows are undated (d NULL) — the same shape as ticking a coaster off a
  // list there — because a ranking carries no date. A rider who later logs the
  // real day gets a dated row alongside it.
  const credited = await creditRanked(env, slug, order);

  // A save that changed nothing is not news — dragging a row and dropping it
  // back would otherwise fill the feed with noise.
  // Credits earned this way ride along IN the ranking entry rather than as a
  // second row. It is one action by the rider, and two lines saying "ranked 20
  // new coasters" and "added 20 credits" would read as two things happening.
  if (added || removed || reordered || credited) {
    await recordRanking(env, slug,
      { added, removed, reordered, credited, total: order.length });
  }

  return { ok: true, count: order.length, credited: credited };
}

// Give the rider an undated credit for every coaster they have ranked but have
// no ride row for. Returns how many were added.
//
// INSERT ... SELECT ... WHERE NOT EXISTS, so it is idempotent: re-saving the
// same order adds nothing the second time. Chunked because the ids are bound
// parameters and D1 caps those per statement — the same limit that once broke
// Save on a long ranking.
async function creditRanked(env, slug, order) {
  if (!order.length) return 0;
  let added = 0;
  for (let i = 0; i < order.length; i += SQL_VARS) {
    const part = order.slice(i, i + SQL_VARS);
    const batch = part.map(id => env.DB.prepare(
      "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,NULL WHERE NOT EXISTS " +
      "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
    ).bind(slug, id, slug, id));
    const res = await env.DB.batch(batch);
    for (const r of res) added += (r && r.meta && r.meta.changes) || 0;
  }
  return added;
}

// ---- Seeding: read the static JSON already in the repo, load into D1 ------
async function fetchAsset(env, url, path) {
  const res = await env.ASSETS.fetch(new URL(path, url).toString());
  if (!res.ok) throw new Error("asset " + path + " -> " + res.status);
  return res.json();
}

async function seed(env, origin) {
  const coasters = (await fetchAsset(env, origin, "/coasters.json")).coasters;
  const parks = await fetchAsset(env, origin, "/parks.json");
  const users = [
    { slug: "carter", name: "Carter", file: "/carter.json" },
    { slug: "cole",   name: "Cole",   file: "/cole.json" },
    { slug: "max",    name: "Max",    file: "/max.json" },
    { slug: "keltan", name: "Keltan", file: "/keltan.json" },
  ];

  const batch = [];
  const P = (sql, ...b) => batch.push(env.DB.prepare(sql).bind(...b));

  // wipe (idempotent reseed)
  for (const t of ["rides","coasters","parks","users"]) batch.push(env.DB.prepare("DELETE FROM " + t));

  for (const c of coasters) {
    P("INSERT INTO coasters (id,name,park,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      c.id, c.name??null, c.park??null, c.type??null, c.manu??null, c.model??null,
      c.h??null, c.s??null, c.l??null, c.inv??null, c.dur??null, c.laps??null, c.yr??null,
      c.opened??null, c.openedPrec??null, c.closed??null, c.closedPrec??null);
  }
  for (const [name, p] of Object.entries(parks)) {
    P("INSERT INTO parks (name,lat,lon,region) VALUES (?,?,?,?)", name, p.lat??null, p.lon??null, p.region??null);
  }
  for (const u of users) {
    const data = await fetchAsset(env, origin, u.file);
    P("INSERT INTO users (slug,name,mode,email,created) VALUES (?,?,'rides',?,datetime('now'))", u.slug, data.user || u.name, null);
    for (const r of (data.rides || [])) {
      const c = typeof r === "object" ? r.c : r;
      const d = typeof r === "object" ? (r.d ?? null) : null;
      P("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)", u.slug, c, d);
    }
  }
  // D1 batch has a per-call statement cap; chunk it.
  const CHUNK = 90;
  for (let i = 0; i < batch.length; i += CHUNK) {
    await env.DB.batch(batch.slice(i, i + CHUNK));
  }
  return { statements: batch.length, coasters: coasters.length, parks: Object.keys(parks).length };
}

// ---- Geocoding: fill lat/lon for parks referenced by coasters but not yet in
//      the parks table, using OpenStreetMap Nominatim (server-side). ----------
const MISSING_PARKS_COUNT =
  "SELECT COUNT(*) AS n FROM (SELECT DISTINCT park FROM coasters " +
  "WHERE park IS NOT NULL AND park NOT IN (SELECT name FROM parks))";

async function geocodeMissing(env, limit) {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT park FROM coasters WHERE park IS NOT NULL AND park NOT IN (SELECT name FROM parks) " +
    "ORDER BY RANDOM() LIMIT ?"
  ).bind(limit).all();

  let added = 0; const failed = [];
  for (const row of results) {
    const park = row.park;
    if (!park || park.indexOf("?") >= 0) { failed.push(park); continue; }
    const q = encodeURIComponent(park);
    let lat = null, lon = null;
    try {
      const res = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + q,
        { headers: { "User-Agent": "coasterhub.org park geocoder (carter.r.blanchard@gmail.com)", "Accept": "application/json" } });
      if (res.ok) { const arr = await res.json(); if (arr && arr[0]) { lat = parseFloat(arr[0].lat); lon = parseFloat(arr[0].lon); } }
    } catch (e) {}
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
      await env.DB.prepare("INSERT OR REPLACE INTO parks (name,lat,lon,region) VALUES (?,?,?,?)")
        .bind(park, lat, lon, null).run();
      added++;
    } else { failed.push(park); }
    await new Promise(r => setTimeout(r, 1100)); // Nominatim usage policy: <= 1 request/second
  }
  const remain = await env.DB.prepare(MISSING_PARKS_COUNT).first();
  return { ok: true, added: added, failed: failed, remaining: remain.n };
}

// ---- Router ---------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Force HTTPS. Typing "coasterhub.org" gets you http://, and without this
    // the page is served over plain HTTP — Safari then shows "Not Secure" in
    // the address bar. Cloudflare's "Always Use HTTPS" toggle does the same
    // job at the edge; this is here so it holds even if that gets switched off.
    // x-forwarded-proto is what Cloudflare sets; url.protocol is the fallback.
    const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    if (proto === "http") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB) return err(503, "database not bound yet");

    try {
      // Who is signed in, resolved once for the whole request. Skipped entirely
      // when there is no cookie, so the public read paths — which is most
      // traffic — cost no extra query.
      const acct = cookieToken(request) ? await currentAccount(request, env) : null;

      // ---- public reads ----
      // Aliases ride along with the coaster list rather than living on their own
      // endpoint: every consumer that needs them already fetches this, and it
      // means the static coasters.json fallback carries them too (sync-static
      // writes this response verbatim).
      if (request.method === "GET" && path === "/api/coasters") {
        return json({ coasters: await getCoasters(env), ...(await getAliases(env)) });
      }
      if (request.method === "GET" && path === "/api/parks") return json(await getParks(env));
      // Who exists. Public: the rider pickers and every /user/<slug>/ page read it.
      if (request.method === "GET" && path === "/api/users") return json({ users: await getUsers(env) });
      // Public read: the feed says what changed, never who is allowed to change it.
      if (request.method === "GET" && path === "/api/activity") {
        const n = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
        return json(await getActivity(env, n));
      }
      const um = path.match(/^\/api\/user\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && um) {
        const u = await getUser(env, um[1].toLowerCase());
        return u ? json(u) : err(404, "no such user");
      }
      const rm = path.match(/^\/api\/rides\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && rm) {
        const r = await getRides(env, rm[1].toLowerCase());
        return r ? json(r) : err(404, "no such user");
      }
      const km = path.match(/^\/api\/rankings\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && km) {
        const r = await getRankings(env, km[1].toLowerCase());
        return r ? json(r) : err(404, "no such user");
      }
      // Ungated on purpose — see RANKINGS_NEED_TOKEN — *until* the rider has an
      // account. Claiming your rider is what closes your own list: before that
      // it stays as open as it has always been, so the riders who predate
      // accounts do not lose the ability to drag their own order while they wait
      // for an invite. No rider is worse off than yesterday, and every one that
      // claims is better off.
      if (request.method === "PUT" && km) {
        const slug = km[1].toLowerCase();
        const claimed = await haveAccounts(env)
          ? await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first()
          : null;
        if (claimed && !mayWriteRider(request, env, slug, acct)) return err(401, "unauthorized");
        if (RANKINGS_NEED_TOKEN && !tokenOk(request, env)) return err(401, "unauthorized");
        const out = await putRankings(env, km[1].toLowerCase(), await request.json());
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, json(out));
      }

      // Bootstrap seed: allowed WITHOUT a token while the DB is still empty, so
      // the site can be populated once right after the D1 binding goes live.
      // After that it requires the admin token like every other write.
      if (request.method === "POST" && path === "/api/admin/seed") {
        const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM coasters").first();
        const empty = !cnt || cnt.c === 0;
        if (!empty && !tokenOk(request, env)) return err(401, "unauthorized");
        return json({ ok: true, ...(await seed(env, url.origin)) });
      }

      // Geocode parks that have no lat/lon yet (so they plot on the map). Open
      // while parks are still missing coordinates (bootstrap fill); once every
      // referenced park is placed, it requires the admin token.
      if (path === "/api/admin/geocode" && (request.method === "POST" || request.method === "GET")) {
        const miss = await env.DB.prepare(MISSING_PARKS_COUNT).first();
        if ((miss.n || 0) === 0 && !tokenOk(request, env)) return err(401, "unauthorized");
        return afterWrite(ctx, env, json(await geocodeMissing(env, 10)));
      }

      // ---- accounts ----
      // A clear answer beats a 500 from a missing table in the window between
      // this Worker deploying and the migration being run.
      if (path.startsWith("/api/auth/") && !await haveAccounts(env)) {
        return path === "/api/auth/me"
          ? json({ account: null })        // "nobody is signed in" is true, and every page copes
          : err(503, "accounts are not set up on this deployment yet");
      }

      // Public by necessity: these are how you get a session in the first place,
      // so they sit above the write gate. Each one is individually rate-limited
      // by nothing at all — worth revisiting if the site is ever found by
      // anyone but friends, but D1 writes are the natural brake for now.

      // Who am I? The header and /log ask on every page load, so a signed-out
      // answer is a 200 with a null account, not a 401 — a 401 here would make
      // "not signed in" look like an error in the console on every page.
      if (request.method === "GET" && path === "/api/auth/me") {
        return json({ account: acct && { email: acct.email, slug: acct.slug, name: acct.name, admin: acct.admin } });
      }

      // Sign up. Open to anyone: creating an account also creates the rider it
      // owns, so a new person lands on an empty count of their own rather than
      // anywhere near an existing one.
      if (request.method === "POST" && path === "/api/auth/signup") {
        const b = await request.json();
        const email = String(b && b.email || "").trim().toLowerCase();
        if (!emailOk(email)) return err(400, "that does not look like an email address");
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const taken = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = ?").bind(email).first();
        // Deliberately explicit rather than a vague "could not sign up": the
        // rider list is public anyway, so which emails are registered is not the
        // secret here, and a silent failure is a support conversation.
        if (taken) return err(409, "there is already an account for that email — sign in instead");

        // Hash FIRST. addUser() writes a rider row and an activity entry, and D1
        // has no transaction spanning these statements, so anything that can
        // fail has to fail before the first write — otherwise a signup that
        // breaks halfway leaves a rider nobody owns on the public site. That is
        // not hypothetical: it is what the 210000-iteration bug did.
        let pwHash;
        try { pwHash = await hashPassword(b.password); }
        catch (e) { return err(500, "could not secure that password: " + (e && e.message || e)); }

        const made = await addUser(env, { name: b && b.name, slug: b && b.slug });
        if (made.bad) return err(made.bad[0], made.bad[1]);
        await env.DB.prepare("UPDATE users SET email = ? WHERE slug = ?").bind(email, made.slug).run();
        const acctId = (await env.DB.prepare(
          "INSERT INTO accounts (email,pw,slug,is_admin,created) VALUES (?,?,?,0,datetime('now')) RETURNING id"
        ).bind(email, pwHash, made.slug).first()).id;
        const raw = await startSession(env, acctId);
        return afterWrite(ctx, env, json({ ok: true, slug: made.slug, name: made.name },
          200, { "set-cookie": setCookie(raw) }));
      }

      // Sign in.
      if (request.method === "POST" && path === "/api/auth/login") {
        const b = await request.json();
        const email = String(b && b.email || "").trim().toLowerCase();
        const row = await env.DB.prepare(
          "SELECT id, pw, slug FROM accounts WHERE lower(email) = ?").bind(email).first();
        // Verify against a dummy hash when the email is unknown, so "no such
        // account" and "wrong password" take the same time and the response is
        // the same either way.
        const ok = row ? await verifyPassword(String(b && b.password || ""), row.pw)
                       : await verifyPassword("x", DUMMY_HASH);
        if (!row || !ok) return err(401, "wrong email or password");
        await env.DB.prepare("UPDATE accounts SET seen = datetime('now') WHERE id = ?").bind(row.id).run();
        const raw = await startSession(env, row.id);
        return json({ ok: true, slug: row.slug }, 200, { "set-cookie": setCookie(raw) });
      }

      // Sign out. Drops the row as well as the cookie, so a copied cookie from
      // another device stops working too.
      if (request.method === "POST" && path === "/api/auth/logout") {
        const raw = cookieToken(request);
        if (raw) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256hex(raw)).run();
        return json({ ok: true }, 200, { "set-cookie": clearCookie() });
      }

      // Claim an existing rider with a one-time invite. This is how the riders
      // who predate accounts (and their rides) get a login without anything
      // moving in the database — the account attaches to the slug that is
      // already there.
      if (request.method === "GET" && path === "/api/auth/invite") {
        const inv = await env.DB.prepare(
          "SELECT i.slug AS slug, i.used AS used, u.name AS name FROM invites i " +
          "LEFT JOIN users u ON u.slug = i.slug WHERE i.code = ?"
        ).bind(String(url.searchParams.get("code") || "")).first();
        if (!inv) return err(404, "that invite link is not valid");
        if (inv.used) return err(410, "that invite link has already been used");
        return json({ ok: true, slug: inv.slug, name: inv.name });
      }
      if (request.method === "POST" && path === "/api/auth/claim") {
        const b = await request.json();
        const code = String(b && b.code || "");
        const email = String(b && b.email || "").trim().toLowerCase();
        if (!emailOk(email)) return err(400, "that does not look like an email address");
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const inv = await env.DB.prepare("SELECT slug, used FROM invites WHERE code = ?").bind(code).first();
        if (!inv) return err(404, "that invite link is not valid");
        if (inv.used) return err(410, "that invite link has already been used");
        const taken = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = ?").bind(email).first();
        if (taken) return err(409, "there is already an account for that email — sign in instead");
        const owned = await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(inv.slug).first();
        if (owned) return err(409, "that rider has already been claimed");
        let claimHash;
        try { claimHash = await hashPassword(b.password); }
        catch (e) { return err(500, "could not secure that password: " + (e && e.message || e)); }
        const acctId = (await env.DB.prepare(
          "INSERT INTO accounts (email,pw,slug,is_admin,created) VALUES (?,?,?,0,datetime('now')) RETURNING id"
        ).bind(email, claimHash, inv.slug).first()).id;
        // Mark the invite spent in the same breath, so a link shared twice by
        // accident cannot make a second account for the same rider.
        await env.DB.prepare("UPDATE invites SET used = datetime('now') WHERE code = ?").bind(code).run();
        await env.DB.prepare("UPDATE users SET email = COALESCE(email, ?) WHERE slug = ?").bind(email, inv.slug).run();
        const raw = await startSession(env, acctId);
        return json({ ok: true, slug: inv.slug }, 200, { "set-cookie": setCookie(raw) });
      }

      // Change your username.
      //
      // `users.name` (the printed name) is deliberately NOT editable here yet —
      // Carter's call, 2026-09-14: username first, display name later. The two
      // are separate columns already, so adding it is a field and a branch, not
      // a migration.
      if (request.method === "POST" && path === "/api/account/profile") {
        if (!acct) return err(401, "sign in first");
        const b = await request.json();
        // Admins may edit anyone; everyone else may edit only themselves. Note
        // the REFUSAL rather than a silent fallback to your own row: quietly
        // retargeting "rename ravi" onto the caller renames the wrong person,
        // which is worse than an error, and it is what the first cut did.
        const asked = b && b.slug_of ? String(b.slug_of).toLowerCase() : null;
        if (asked && asked !== acct.slug && !acct.admin) return err(401, "unauthorized");
        const target = asked || acct.slug;
        if (!target) return err(400, "this account is not attached to a rider");
        const who = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(target).first();
        if (!who) return err(404, "no such rider");

        const wanted = String(b && b.username || "").trim();
        if (!wanted) return err(400, "give yourself a username");
        const wantSlug = slugify(wanted);
        const slugBad = await slugProblem(env, wantSlug, who.slug);
        if (slugBad) return err(409, slugBad);

        if (wantSlug !== who.slug) await renameRider(env, who.slug, wantSlug);
        return afterWrite(ctx, env, json({ ok: true, slug: wantSlug, name: who.name,
          renamed: wantSlug !== who.slug, was: who.slug }));
      }

      // Change your own password. Requires the current one: a borrowed session
      // should not be able to lock the owner out of their own count.
      if (request.method === "POST" && path === "/api/auth/password") {
        if (!acct) return err(401, "sign in first");
        const b = await request.json();
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const row = await env.DB.prepare("SELECT pw FROM accounts WHERE id = ?").bind(acct.id).first();
        if (!row || !await verifyPassword(String(b && b.current || ""), row.pw)) {
          return err(401, "that is not your current password");
        }
        await env.DB.prepare("UPDATE accounts SET pw = ? WHERE id = ?")
          .bind(await hashPassword(b.password), acct.id).run();
        // Every other session for this account dies; the one making the change
        // gets a fresh cookie. This is what makes a password change useful after
        // "I think someone has my login".
        await env.DB.prepare("DELETE FROM sessions WHERE account = ?").bind(acct.id).run();
        const raw = await startSession(env, acct.id);
        return json({ ok: true }, 200, { "set-cookie": setCookie(raw) });
      }

      // ---- rider-owned writes ----
      // These carry their own authorization (mayWriteRider) instead of the
      // blanket admin check below: the whole point of accounts is that Cole can
      // log Cole's day without holding a key to the coaster database.

      // Log a whole park day (see addRides) — used by /log.
      if (request.method === "POST" && path === "/api/rides") {
        const b = await request.json();
        if (!mayWriteRider(request, env, b && b.user, acct)) return err(401, "unauthorized");
        const out = await addRides(env, b);
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, json({ ok: true, ...out }));
      }
      // Add a rider's credit — one undated ride, unless they already have the
      // coaster, in which case there is nothing to add.
      if (request.method === "POST" && path === "/api/credit") {
        const b = await request.json();
        if (!b.user || !b.coaster_id) return err(400, "need user + coaster_id");
        if (!mayWriteRider(request, env, b.user, acct)) return err(401, "unauthorized");
        await env.DB.prepare(
          "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,? WHERE NOT EXISTS " +
          "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
        ).bind(b.user, b.coaster_id, b.first??null, b.user, b.coaster_id).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }
      // Remove a rider's credit — every ride of it, not just one lap.
      if (request.method === "DELETE" && path === "/api/credit") {
        const b = await request.json();
        if (!mayWriteRider(request, env, b && b.user, acct)) return err(401, "unauthorized");
        await env.DB.prepare("DELETE FROM rides WHERE user_slug = ? AND coaster_id = ?").bind(b.user, b.coaster_id).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }
      // Undo a single mis-tapped ride (dated ride log only). The owner is on the
      // row, not in the body, so this reads first and authorizes second.
      if (request.method === "DELETE" && path === "/api/ride") {
        const b = await request.json();
        const i = Number(b && b.i);
        if (!Number.isInteger(i) || i <= 0) return err(400, "need i (ride row id)");
        const row = await env.DB.prepare(
          "SELECT r.user_slug AS slug, c.name AS name FROM rides r " +
          "LEFT JOIN coasters c ON c.id = r.coaster_id WHERE r.id = ?"
        ).bind(i).first();
        if (!row) return err(404, "no such ride");
        if (!mayWriteRider(request, env, row.slug, acct)) return err(401, "unauthorized");
        await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(i).run();
        await recordActivity(env, "ride_removed", { actor: row.slug, subject: row.name });
        return afterWrite(ctx, env, json({ ok: true, ...(await userTotal(env, row.slug)) }));
      }

      // ---- writes (auth required) ----
      const needsAuth = path.startsWith("/api/admin/") || request.method !== "GET";
      if (needsAuth && !tokenOk(request, env)) return err(401, "unauthorized");

      // Invite an existing rider to claim their count. Admin only, and it hands
      // back a URL rather than mailing it — there is no mail out of this Worker.
      if (request.method === "POST" && path === "/api/admin/invite") {
        if (!await haveAccounts(env)) return err(503, "run migrations/003-accounts.sql first");
        const b = await request.json();
        const slug = String(b && b.slug || "").toLowerCase();
        const u = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(slug).first();
        if (!u) return err(404, "no such rider");
        const owned = await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first();
        if (owned) return err(409, "that rider already has an account");
        const code = randomToken();
        await env.DB.prepare("INSERT INTO invites (code,slug,created) VALUES (?,?,datetime('now'))")
          .bind(code, slug).run();
        return json({ ok: true, slug: slug, name: u.name, url: url.origin + "/account?claim=" + code });
      }

      // login check (lets the /edit page validate the password)
      if (request.method === "POST" && path === "/api/admin/login") return json({ ok: true });

      // add a rider, so a new person can be logged/imported the moment they turn
      // up rather than after a code change. They start with no rides at all.
      if (request.method === "POST" && path === "/api/user") {
        const out = await addUser(env, await request.json());
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, json(out));
      }

      // create coaster (id = max+1)
      if (request.method === "POST" && path === "/api/coaster") {
        const b = await request.json();
        const row = await env.DB.prepare("SELECT COALESCE(MAX(id),0)+1 AS nid FROM coasters").first();
        const id = row.nid;
        await env.DB.prepare(
          "INSERT INTO coasters (id,name,park,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(id, b.name??null, b.park??null, b.type??"Steel", b.manu??null, b.model??null,
          b.h??null, b.s??null, b.l??null, b.inv??null, b.dur??null, b.laps??1, b.yr??null,
          b.opened??null, b.openedPrec??null, b.closed??null, b.closedPrec??null).run();
        await recordActivity(env, "coaster_added",
          { subject: b.name ?? null, detail: { id: id, park: b.park ?? null } });
        return afterWrite(ctx, env, json({ ok: true, id }));
      }

      // update coaster fields
      const cm = path.match(/^\/api\/coaster\/(\d+)$/);
      if (request.method === "PUT" && cm) {
        const id = Number(cm[1]);
        const b = await request.json();
        const sets = [], vals = [];
        for (const f of COASTER_FIELDS) if (f in b) { sets.push(f + " = ?"); vals.push(b[f]); }
        if (!sets.length) return err(400, "no fields");
        // Read the old name BEFORE the update — a rename is the moment a former
        // name exists, and it is unrecoverable afterwards. Read unconditionally
        // now, so an edit that only fills in specs still has a name to report.
        const prev = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(id).first();
        vals.push(id);
        await env.DB.prepare("UPDATE coasters SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
        if ("name" in b && prev && prev.name && prev.name !== b.name) {
          const st = recordAlias(env, id, prev.name, "rename");
          // A name that has become current again is no longer a FORMER name.
          // Without this, renaming A->B->A leaves "A" aliased to a coaster
          // called A, and /add would answer "that's the old name, it's now A".
          const undo = env.DB.prepare(
            "DELETE FROM coaster_aliases WHERE coaster_id = ? AND former_name = ?"
          ).bind(id, b.name);
          await env.DB.batch(st ? [st, undo] : [undo]);
        }
        // A rename is worth naming in the feed; a spec fill-in is just upkeep,
        // so it says which fields moved rather than listing every value.
        if ("name" in b && prev && prev.name && prev.name !== b.name) {
          // The park rides along so /changes can say WHERE it happened: two names
          // and no place is a riddle when the same retheme lands at six parks.
          await recordActivity(env, "coaster_renamed",
            { subject: b.name, detail: { id: id, from: prev.name, park: (b.park ?? prev.park) || null } });
        } else {
          await recordActivity(env, "coaster_edited",
            { subject: (prev && prev.name) || null, n: sets.length,
              detail: { id: id, fields: COASTER_FIELDS.filter(f => f in b) } });
        }
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // who still has this coaster — drives the delete button's label in /edit,
      // so you know what you are about to remove before you click it
      const um2 = path.match(/^\/api\/coaster\/(\d+)\/usage$/);
      if (request.method === "GET" && um2) {
        const id = Number(um2[1]);
        const row = await env.DB.prepare("SELECT id, name, park FROM coasters WHERE id = ?").bind(id).first();
        if (!row) return err(404, "no such coaster");
        const { results } = await env.DB.prepare(
          "SELECT r.user_slug AS slug, u.name AS name, COUNT(*) AS rides " +
          "FROM rides r LEFT JOIN users u ON u.slug = r.user_slug " +
          "WHERE r.coaster_id = ? GROUP BY r.user_slug, u.name ORDER BY u.name"
        ).bind(id).all();
        return json({
          id, name: row.name, park: row.park,
          riders: results,
          rides: results.reduce((a, r) => a + r.rides, 0),
        });
      }

      // delete a coaster — refuses while anyone still has it
      //
      // A ride is a fact about a person, so this never cascades. If riders hold
      // the coaster the right move is /api/merge, which moves them onto the
      // surviving row; deleting would silently take credits off their count.
      // The 409 carries the breakdown so the UI can say exactly who.
      if (request.method === "DELETE" && cm) {
        const id = Number(cm[1]);
        const row = await env.DB.prepare("SELECT id, name, park FROM coasters WHERE id = ?").bind(id).first();
        if (!row) return err(404, "no such coaster");
        const { results } = await env.DB.prepare(
          "SELECT r.user_slug AS slug, u.name AS name, COUNT(*) AS rides " +
          "FROM rides r LEFT JOIN users u ON u.slug = r.user_slug " +
          "WHERE r.coaster_id = ? GROUP BY r.user_slug, u.name ORDER BY u.name"
        ).bind(id).all();
        if (results.length) {
          return json({
            error: results.length + " rider" + (results.length === 1 ? "" : "s") +
                   " still have this coaster — merge it instead of deleting it",
            riders: results,
            rides: results.reduce((a, r) => a + r.rides, 0),
          }, 409);
        }
        // Belt and braces: the guard above is a separate read, so re-assert it in
        // the statement itself rather than trusting nothing landed in between.
        const res = await env.DB.prepare(
          "DELETE FROM coasters WHERE id = ? AND id NOT IN (SELECT coaster_id FROM rides)"
        ).bind(id).run();
        if (!res.meta || res.meta.changes === 0) return err(409, "coaster is still in use");
        // Its former names go with it — an alias pointing at a deleted id would
        // resolve to nothing and quietly suppress the "not listed" warning.
        await env.DB.prepare("DELETE FROM coaster_aliases WHERE coaster_id = ?").bind(id).run();
        await recordActivity(env, "coaster_deleted",
          { subject: row.name, detail: { id: id, park: row.park } });
        return afterWrite(ctx, env, json({ ok: true, deleted: id, name: row.name, park: row.park }));
      }

      // merge coaster `from` into `to` (repoints every ride, deletes `from`)
      // Two undated rows for the same rider would collapse into one credit
      // anyway, so the dedupe keeps the table honest rather than changing counts.
      if (request.method === "POST" && path === "/api/merge") {
        const { from, to } = await request.json();
        if (!from || !to || from === to) return err(400, "need distinct from/to");
        // The disappearing row's name is a former name of the survivor, and any
        // alias it already carried has to come with it — otherwise merging a
        // coaster silently throws away everything it was ever called.
        const src = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(from).first();
        const batch = [
          env.DB.prepare("UPDATE rides SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare(
            "DELETE FROM rides WHERE d IS NULL AND id NOT IN " +
            "(SELECT MIN(id) FROM rides WHERE d IS NULL GROUP BY user_slug, coaster_id)"
          ),
          env.DB.prepare("UPDATE OR IGNORE coaster_aliases SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare("DELETE FROM coaster_aliases WHERE coaster_id = ?").bind(from),
          env.DB.prepare("DELETE FROM coasters WHERE id = ?").bind(from),
        ];
        const rec = src && recordAlias(env, to, src.name, "merge");
        if (rec) batch.unshift(rec);
        await env.DB.batch(batch);
        const dst = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(to).first();
        await recordActivity(env, "coaster_merged", {
          subject: dst ? dst.name : null,
          // The surviving coaster's park, falling back to the one that was
          // merged away — read before the delete, while its row still existed.
          detail: { from: from, to: to, fromName: src ? src.name : null,
                    park: (dst && dst.park) || (src && src.park) || null },
        });
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // every park referenced by a coaster, with coords (null = not on the map yet) + coaster count
      if (request.method === "GET" && path === "/api/parks-all") {
        const { results } = await env.DB.prepare(
          "SELECT c.park AS name, p.lat AS lat, p.lon AS lon, p.region AS region, COUNT(*) AS coasters " +
          "FROM coasters c LEFT JOIN parks p ON p.name = c.park " +
          "WHERE c.park IS NOT NULL GROUP BY c.park ORDER BY c.park"
        ).all();
        return json({ parks: results });
      }
      // upsert a park's coordinates / region (used by the parks editor)
      if (request.method === "PUT" && path === "/api/park") {
        const b = await request.json();
        if (!b.name) return err(400, "need name");
        await env.DB.prepare(
          // COALESCE, not a plain overwrite: adding a park that already exists
          // must never blank its coordinates. The geocoder and the parks editor
          // still set values, they just cannot clear them from here.
          "INSERT INTO parks (name,lat,lon,region) VALUES (?,?,?,?) " +
          "ON CONFLICT(name) DO UPDATE SET lat=COALESCE(excluded.lat,lat), " +
          "lon=COALESCE(excluded.lon,lon), region=COALESCE(excluded.region,region)"
        ).bind(b.name, b.lat ?? null, b.lon ?? null, b.region ?? null).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }

      return err(404, "no such endpoint");
    } catch (e) {
      return err(500, String(e && e.message || e));
    }
  }
};
