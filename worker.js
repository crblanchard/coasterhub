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
const COASTER_FIELDS = ["name","park","loc","type","manu","model","h","s","l","inv","dur","laps","yr","opened","openedPrec","closed","closedPrec"];

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
    P("INSERT INTO coasters (id,name,park,loc,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      c.id, c.name??null, c.park??null, c.loc??null, c.type??null, c.manu??null, c.model??null,
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

// ---- Router ---------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

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

      // Bootstrap seed: allowed WITHOUT a token while the DB is still empty, so
      // the site can be populated once right after the D1 binding goes live.
      // After that it requires the admin token like every other write.
      if (request.method === "POST" && path === "/api/admin/seed") {
        const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM coasters").first();
        const empty = !cnt || cnt.c === 0;
        if (!empty && !tokenOk(request, env)) return err(401, "unauthorized");
        return json({ ok: true, ...(await seed(env, url.origin)) });
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
          "INSERT INTO coasters (id,name,park,loc,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(id, b.name??null, b.park??null, b.loc??null, b.type??"Steel", b.manu??null, b.model??null,
          b.h??null, b.s??null, b.l??null, b.inv??null, b.dur??null, b.laps??1, b.yr??null,
          b.opened??null, b.openedPrec??null, b.closed??null, b.closedPrec??null).run();
        return json({ ok: true, id });
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
        return json({ ok: true });
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
        return json({ ok: true });
      }

      // add / update a rider's credit
      if (request.method === "POST" && path === "/api/credit") {
        const b = await request.json();
        if (!b.user || !b.coaster_id) return err(400, "need user + coaster_id");
        await env.DB.prepare(
          "INSERT INTO credits (user_slug,coaster_id,first,num,n) VALUES (?,?,?,?,?) " +
          "ON CONFLICT(user_slug,coaster_id) DO UPDATE SET first=excluded.first, num=excluded.num, n=excluded.n"
        ).bind(b.user, b.coaster_id, b.first??null, b.num??null, b.n??null).run();
        return json({ ok: true });
      }
      // remove a rider's credit
      if (request.method === "DELETE" && path === "/api/credit") {
        const b = await request.json();
        await env.DB.prepare("DELETE FROM credits WHERE user_slug = ? AND coaster_id = ?").bind(b.user, b.coaster_id).run();
        return json({ ok: true });
      }

      return err(404, "no such endpoint");
    } catch (e) {
      return err(500, String(e && e.message || e));
    }
  }
};
