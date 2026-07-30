#!/usr/bin/env node
/* Local stand-in for worker.js, for verifying pages in a real browser.
 *
 *   node tools/dev-server.mjs            # http://127.0.0.1:8099
 *   PORT=8090 node tools/dev-server.mjs
 *
 * Serves the repo statically, mirrors the _redirects 200-rewrites, and stubs
 * enough of the API that /log, /add, /edit and /rankings can actually be driven.
 * Password is "letmein". Reads the JSON files off disk per request, so edits
 * show up without a restart.
 *
 * The handoff asks for pages to be rendered and looked at before pushing —
 * most bugs in this project have been mobile-only, and one shipped syntax error
 * took out the whole inline script on two pages. This is what makes that check
 * a thirty-second job. It is a dev tool: it is never deployed (see .assetsignore)
 * and it does not touch D1.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PW = "letmein";
const PORT = process.env.PORT || 8099;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const RD = f => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
const RANK = { carter: [530, 201, 400, 289, 105, 78, 101, 542], cole: [], keltan: [], max: [] };

// id 999001 stands for "nobody has ridden it", so both branches of the /edit
// delete UI can be exercised; every other id reports riders.
const FREE_ID = 999001;
const HELD = [{ slug: "carter", name: "Carter", rides: 2 }, { slug: "cole", name: "Cole", rides: 1 }];
let nextId = 900000;
const body = req => new Promise(r => { let s = ""; req.on("data", d => (s += d)); req.on("end", () => r(s)); });

createServer(async (req, res) => {
  const u = req.url.split("?")[0];
  const out = (o, code) => { res.statusCode = code || 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  const authed = () => req.headers["x-admin-token"] === PW;
  const deny = () => out({ error: "unauthorized" }, 401);

  try {
    // rankings: open, matching RANKINGS_NEED_TOKEN = false
    const rk = u.match(/^\/api\/rankings\/(\w+)/);
    if (rk && req.method === "PUT") {
      const b = JSON.parse((await body(req)) || "{}");
      return out({ ok: true, count: [...new Set(b.order || [])].length });
    }
    if (rk) return out({ slug: rk[1], order: RANK[rk[1]] || [] });

    if (u === "/api/coasters" && req.method === "GET") return out(RD("coasters.json"));
    if (u === "/api/parks" && req.method === "GET") return out(RD("parks.json"));
    const ur = u.match(/^\/api\/(?:user|rides)\/([a-z0-9-]+)$/i);
    if (ur && req.method === "GET") {
      const f = ur[1].toLowerCase() + ".json";
      if (!existsSync(join(ROOT, f))) return out({ error: "no such user" }, 404);
      const d = RD(f);
      return out({ user: d.user, rides: (d.rides || []).map((r, i) => ({ i: i + 1, c: r.c, d: r.d ?? null })) });
    }
    if (u === "/api/parks-all" && req.method === "GET") {
      const parks = RD("parks.json"), n = {};
      for (const c of RD("coasters.json").coasters) if (c.park) n[c.park] = (n[c.park] || 0) + 1;
      return out({ parks: Object.keys(n).sort().map(name => ({ name, coasters: n[name],
        lat: (parks[name] || {}).lat ?? null, lon: (parks[name] || {}).lon ?? null,
        region: (parks[name] || {}).region ?? null })) });
    }
    const cu = u.match(/^\/api\/coaster\/(\d+)\/usage$/);
    if (cu && req.method === "GET") {
      const id = Number(cu[1]);
      return id === FREE_ID ? out({ id, name: "Test", park: "Cedar Point", riders: [], rides: 0 })
                            : out({ id, name: "Held", park: "Cedar Point", riders: HELD, rides: 3 });
    }

    // ---- gated ----
    if (u === "/api/admin/login" && req.method === "POST") return authed() ? out({ ok: true }) : deny();
    if (u.startsWith("/api/")) {
      if (req.method !== "GET" && !authed()) return deny();
      const cd = u.match(/^\/api\/coaster\/(\d+)$/);
      if (cd && req.method === "DELETE") {
        const id = Number(cd[1]);
        if (id !== FREE_ID) return out({ error: "2 riders still have this coaster — merge it instead", riders: HELD, rides: 3 }, 409);
        return out({ ok: true, deleted: id, name: "Test", park: "Cedar Point" });
      }
      if (cd && req.method === "PUT") return out({ ok: true });
      if (u === "/api/coaster" && req.method === "POST") return out({ ok: true, id: nextId++ });
      if (u === "/api/park" && req.method === "PUT") return out({ ok: true });
      if (u === "/api/merge" && req.method === "POST") return out({ ok: true });
      if (u === "/api/rides" && req.method === "POST") {
        const b = JSON.parse((await body(req)) || "{}");
        const n = (b.entries || []).reduce((a, e) => a + (b.d == null ? 1 : (e.n || 1)), 0);
        return out({ ok: true, added: n, coasters: (b.entries || []).length,
                     total: 2362 + n, credits: 562, date: b.d ?? null });
      }
      res.statusCode = 404; return res.end("no api");
    }

    // ---- static, mirroring _redirects ----
    let f = u === "/" ? "/index.html" : u;
    const pretty = ["coasters", "rides", "stats", "rankings", "add", "log", "edit", "database"];
    const um = f.match(/^\/user\/[^/]+\/([^/]+)$/);
    if (um && pretty.includes(um[1])) f = "/" + um[1] + ".html";
    else if (pretty.includes(f.slice(1))) f = f + ".html";
    const p = join(ROOT, f);
    if (!existsSync(p)) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("content-type", TYPES[extname(p)] || "text/plain");
    res.end(readFileSync(p));
  } catch (e) {
    res.statusCode = 500; res.end("dev-server: " + e.message);
  }
}).listen(PORT, () => console.log("dev server on http://127.0.0.1:" + PORT));
