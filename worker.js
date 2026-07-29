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
async function getParks(env) {
  const { results } = await env.DB.prepare("SELECT * FROM parks").all();
  const out = {};
  for (const p of results) out[p.name] = { lat: p.lat, lon: p.lon, region: p.region };
  return out;
}
async function getUser(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  if (u.mode === "rides") {
    const { results } = await env.DB.prepare("SELECT coaster_id, d FROM rides WHERE user_slug = ? ORDER BY id").bind(slug).all();
    return { user: u.name, rides: results.map(x => ({ c: x.coaster_id, d: x.d })) };
  }
  const { results } = await env.DB.prepare("SELECT coaster_id, first, num, n FROM credits WHERE user_slug = ? ORDER BY id").bind(slug).all();
  const credits = results.map(x => {
    const o = { c: x.coaster_id };
    if (x.first != null) o.first = x.first;
    if (x.num != null) o.num = x.num;
    if (x.n != null) o.n = x.n;
    return o;
  });
  return { user: u.name, credits };
}

// ---- Ride log -------------------------------------------------------------
// One shape for every rider so a single page can render them all:
//   { user, mode, rides:[{ i?, c, d, num?, n? }] }
// `rides`-mode riders (a full dated log) get one entry per ride INCLUDING the
// row id, so an individual mis-tapped ride can be deleted. `credits`-mode riders
// are projected into the same shape with d = first-ridden, so they render as a
// "credit log" (each coaster once) rather than a ride-by-ride history.
async function getRides(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  if (u.mode === "rides") {
    const { results } = await env.DB.prepare(
      "SELECT id, coaster_id, d FROM rides WHERE user_slug = ? ORDER BY d, id"
    ).bind(slug).all();
    return { user: u.name, mode: "rides", rides: results.map(x => ({ i: x.id, c: x.coaster_id, d: x.d })) };
  }
  const { results } = await env.DB.prepare(
    "SELECT coaster_id, first, num, n FROM credits WHERE user_slug = ? ORDER BY id"
  ).bind(slug).all();
  return { user: u.name, mode: "credits", rides: results.map(x => {
    const o = { c: x.coaster_id, d: x.first == null ? null : x.first };
    if (x.num != null) o.num = x.num;
    if (x.n != null) o.n = x.n;
    return o;
  }) };
}

async function userTotal(env, slug, mode) {
  const t = mode === "rides"
    ? await env.DB.prepare("SELECT COUNT(*) AS n FROM rides WHERE user_slug = ?").bind(slug).first()
    : await env.DB.prepare("SELECT COUNT(*) AS n FROM credits WHERE user_slug = ?").bind(slug).first();
  return t ? t.n : 0;
}

// Log a whole park day in one batch: { user, d:"YYYY-MM-DD", entries:[{c,n}] }.
// EVERY coaster id is validated up front and the whole batch is rejected if any
// is unknown — a typo must never half-log a day. Returns {added, total, date}.
async function addRides(env, b) {
  const slug = String(b && b.user || "").toLowerCase();
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [400, "no such user"] };

  const d = String(b && b.d || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { bad: [400, "need d as YYYY-MM-DD"] };

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
  const { results } = await env.DB.prepare(
    "SELECT id FROM coasters WHERE id IN (" + ids.map(() => "?").join(",") + ")"
  ).bind(...ids).all();
  const known = new Set(results.map(r => r.id));
  const unknown = ids.filter(i => !known.has(i));
  if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };

  const batch = [];
  if (u.mode === "rides") {
    // one row per lap, so each ride stays individually deletable
    for (const e of norm) {
      for (let k = 0; k < e.n; k++) {
        batch.push(env.DB.prepare("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)").bind(slug, e.c, d));
      }
    }
  } else {
    // credits-mode: earliest date wins, ride counts accumulate, an existing
    // credit number (Max's milestones) is never touched.
    for (const e of norm) {
      batch.push(env.DB.prepare(
        "INSERT INTO credits (user_slug,coaster_id,first,num,n) VALUES (?,?,?,NULL,?) " +
        "ON CONFLICT(user_slug,coaster_id) DO UPDATE SET " +
        "first = CASE WHEN first IS NULL THEN excluded.first " +
        "WHEN excluded.first < first THEN excluded.first ELSE first END, " +
        "n = COALESCE(n,0) + excluded.n"
      ).bind(slug, e.c, d, e.n));
    }
  }

  const CHUNK = 90;                            // D1 caps statements per batch call
  for (let i = 0; i < batch.length; i += CHUNK) await env.DB.batch(batch.slice(i, i + CHUNK));

  return {
    added: norm.reduce((a, e) => a + e.n, 0),
    coasters: norm.length,
    total: await userTotal(env, slug, u.mode),
    date: d,
  };
}

// ---- Rankings -------------------------------------------------------------
// A rider's personal order of the coasters they've ridden, best first. Stored as
// (user, coaster, pos) with pos 1 = favourite.
//
// Writes are currently OPEN — anyone can PUT anyone's ranking. That is Carter's
// call for now; flip RANKINGS_NEED_TOKEN to true (and nothing else) to put them
// behind the same admin token as /edit and /log.
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
    const { results } = await env.DB.prepare(
      "SELECT id FROM coasters WHERE id IN (" + order.map(() => "?").join(",") + ")"
    ).bind(...order).all();
    const known = new Set(results.map(r => r.id));
    const unknown = order.filter(i => !known.has(i));
    if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };
  }

  const batch = [env.DB.prepare("DELETE FROM rankings WHERE user_slug = ?").bind(slug)];
  order.forEach((id, i) => {
    batch.push(env.DB.prepare("INSERT INTO rankings (user_slug,coaster_id,pos) VALUES (?,?,?)")
      .bind(slug, id, i + 1));
  });
  const CHUNK = 90;
  for (let i = 0; i < batch.length; i += CHUNK) await env.DB.batch(batch.slice(i, i + CHUNK));

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
  for (const t of ["rides","credits","coasters","parks","users"]) batch.push(env.DB.prepare("DELETE FROM " + t));

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
    const mode = Array.isArray(data.rides) ? "rides" : "credits";
    P("INSERT INTO users (slug,name,mode,email,created) VALUES (?,?,?,?,datetime('now'))", u.slug, data.user || u.name, mode, null);
    if (mode === "rides") {
      for (const r of data.rides) {
        const c = typeof r === "object" ? r.c : r;
        const d = typeof r === "object" ? (r.d ?? null) : null;
        P("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)", u.slug, c, d);
      }
    } else {
      for (const cr of data.credits) {
        const c = typeof cr === "object" ? cr.c : cr;
        const first = typeof cr === "object" ? (cr.first ?? null) : null;
        const num = typeof cr === "object" ? (cr.num ?? null) : null;
        const n = typeof cr === "object" ? (cr.n ?? null) : null;
        P("INSERT OR IGNORE INTO credits (user_slug,coaster_id,first,num,n) VALUES (?,?,?,?,?)", u.slug, c, first, num, n);
      }
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
      if (request.method === "GET" && path === "/api/coasters") return json({ coasters: await getCoasters(env) });
      if (request.method === "GET" && path === "/api/parks") return json(await getParks(env));
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
      // Ungated on purpose for now — see RANKINGS_NEED_TOKEN.
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
        vals.push(id);
        await env.DB.prepare("UPDATE coasters SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // merge coaster `from` into `to` (repoints all credits/rides, deletes `from`)
      if (request.method === "POST" && path === "/api/merge") {
        const { from, to } = await request.json();
        if (!from || !to || from === to) return err(400, "need distinct from/to");
        await env.DB.batch([
          env.DB.prepare("UPDATE OR IGNORE credits SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare("DELETE FROM credits WHERE coaster_id = ?").bind(from),
          env.DB.prepare("UPDATE rides SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare("DELETE FROM coasters WHERE id = ?").bind(from),
        ]);
        return afterWrite(ctx, env, json({ ok: true }));
      }

      // add / update a rider's credit
      if (request.method === "POST" && path === "/api/credit") {
        const b = await request.json();
        if (!b.user || !b.coaster_id) return err(400, "need user + coaster_id");
        await env.DB.prepare(
          "INSERT INTO credits (user_slug,coaster_id,first,num,n) VALUES (?,?,?,?,?) " +
          "ON CONFLICT(user_slug,coaster_id) DO UPDATE SET first=excluded.first, num=excluded.num, n=excluded.n"
        ).bind(b.user, b.coaster_id, b.first??null, b.num??null, b.n??null).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }
      // remove a rider's credit
      if (request.method === "DELETE" && path === "/api/credit") {
        const b = await request.json();
        await env.DB.prepare("DELETE FROM credits WHERE user_slug = ? AND coaster_id = ?").bind(b.user, b.coaster_id).run();
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
        const row = await env.DB.prepare("SELECT user_slug FROM rides WHERE id = ?").bind(i).first();
        if (!row) return err(404, "no such ride");
        await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(i).run();
        return afterWrite(ctx, env, json({ ok: true, total: await userTotal(env, row.user_slug, "rides") }));
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
          "INSERT INTO parks (name,lat,lon,region) VALUES (?,?,?,?) " +
          "ON CONFLICT(name) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, region=excluded.region"
        ).bind(b.name, b.lat ?? null, b.lon ?? null, b.region ?? null).run();
        return afterWrite(ctx, env, json({ ok: true }));
      }

      return err(404, "no such endpoint");
    } catch (e) {
      return err(500, String(e && e.message || e));
    }
  }
};
