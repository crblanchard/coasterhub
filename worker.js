// Coaster Hub — Worker entrypoint.
// Serves the static site (via the ASSETS binding) and a small JSON API backed
// by a D1 database (binding: DB). The API is additive and DEFENSIVE: if D1 is
// not bound yet, every /api/* route returns 503 and the static site still works
// exactly as before. Reads are public; writes require the admin token.
//
// Bindings (see wrangler.jsonc):
//   ASSETS  - static assets (the repo files)
//   DB      - D1 database "coasterhub"
//   ADMIN_PASSWORD - secret; required for all write endpoints + /api/admin/*

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

  // A save that changed nothing is not news — dragging a row and dropping it
  // back would otherwise fill the feed with noise.
  if (added || removed || reordered) {
    await recordActivity(env, "ranking", {
      actor: slug, n: added || removed || order.length,
      detail: { added: added, removed: removed, reordered: reordered, total: order.length },
    });
  }

  return { ok: true, count: order.length };
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
      // ---- public reads ----
      // Aliases ride along with the coaster list rather than living on their own
      // endpoint: every consumer that needs them already fetches this, and it
      // means the static coasters.json fallback carries them too (sync-static
      // writes this response verbatim).
      if (request.method === "GET" && path === "/api/coasters") {
        return json({ coasters: await getCoasters(env), ...(await getAliases(env)) });
      }
      if (request.method === "GET" && path === "/api/parks") return json(await getParks(env));
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
      // Ungated on purpose — see RANKINGS_NEED_TOKEN.
      if (request.method === "PUT" && km) {
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

      // ---- writes (auth required) ----
      const needsAuth = path.startsWith("/api/admin/") || request.method !== "GET";
      if (needsAuth && !tokenOk(request, env)) return err(401, "unauthorized");

      // login check (lets the /edit page validate the password)
      if (request.method === "POST" && path === "/api/admin/login") return json({ ok: true });

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
        const prev = await env.DB.prepare("SELECT name FROM coasters WHERE id = ?").bind(id).first();
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
          await recordActivity(env, "coaster_renamed",
            { subject: b.name, detail: { id: id, from: prev.name } });
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
        const src = await env.DB.prepare("SELECT name FROM coasters WHERE id = ?").bind(from).first();
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
        const dst = await env.DB.prepare("SELECT name FROM coasters WHERE id = ?").bind(to).first();
        await recordActivity(env, "coaster_merged", {
          subject: dst ? dst.name : null,
          detail: { from: from, to: to, fromName: src ? src.name : null },
        });
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // add a rider's credit — one undated ride, unless they already have the
      // coaster, in which case there is nothing to add
      if (request.method === "POST" && path === "/api/credit") {
        const b = await request.json();
        if (!b.user || !b.coaster_id) return err(400, "need user + coaster_id");
        await env.DB.prepare(
          "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,? WHERE NOT EXISTS " +
          "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
        ).bind(b.user, b.coaster_id, b.first??null, b.user, b.coaster_id).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }
      // remove a rider's credit — every ride of it, not just one lap
      if (request.method === "DELETE" && path === "/api/credit") {
        const b = await request.json();
        await env.DB.prepare("DELETE FROM rides WHERE user_slug = ? AND coaster_id = ?").bind(b.user, b.coaster_id).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // log a whole park day (see addRides) — used by /log
      if (request.method === "POST" && path === "/api/rides") {
        const out = await addRides(env, await request.json());
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, json({ ok: true, ...out }));
      }
      // undo a single mis-tapped ride (dated ride log only)
      if (request.method === "DELETE" && path === "/api/ride") {
        const b = await request.json();
        const i = Number(b && b.i);
        if (!Number.isInteger(i) || i <= 0) return err(400, "need i (ride row id)");
        const row = await env.DB.prepare(
          "SELECT r.user_slug AS slug, c.name AS name FROM rides r " +
          "LEFT JOIN coasters c ON c.id = r.coaster_id WHERE r.id = ?"
        ).bind(i).first();
        if (!row) return err(404, "no such ride");
        await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(i).run();
        await recordActivity(env, "ride_removed", { actor: row.slug, subject: row.name });
        return afterWrite(ctx, env, json({ ok: true, ...(await userTotal(env, row.slug)) }));
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
