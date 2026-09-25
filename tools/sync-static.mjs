#!/usr/bin/env node
/* Coaster Hub — refresh the static JSON from the live D1-backed API.
 *
 * The site's source of truth is Cloudflare D1 (served by worker.js at
 * /api/coasters, /api/parks, /api/user/<slug>). The static JSON files in the
 * repo root are the *seed* + an offline fallback + the data the Home/"All" hub
 * view reads directly — so after editing data in /edit they drift out of date.
 * This script pulls the current API responses and rewrites the static files so
 * everything matches D1 again, in one consistent snapshot.
 *
 * Usage (run from anywhere; writes to the repo root):
 *   node tools/sync-static.mjs                 # uses https://coasterhub.org
 *   node tools/sync-static.mjs http://localhost:8787   # a local `wrangler dev`
 *
 * It writes: coasters.json, parks.json, and one <slug>.json per rider.
 * Coasters + user files are fetched together so credit ids stay consistent
 * with any merges. Compact one-line JSON is used to match the existing files.
 */
import { writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.argv[2] || "https://coasterhub.org").replace(/\/$/, "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Riders to sync. Taken from the live API (/api/users) so anyone added on /log
// or /import gets a static file too; this list is only the fallback for an old
// deployment that predates that endpoint.
const FALLBACK_SLUGS = ["crblanchard", "cole", "keltan", "max", "sean"];

async function getJSON(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}
// Compact, no spaces — matches the committed files (keeps diffs meaningful).
const compact = (obj) => JSON.stringify(obj);

async function main() {
  console.log("Syncing static JSON from " + BASE + " …");

  const coasters = await getJSON("/api/coasters"); // { coasters: [...] }
  await writeFile(join(ROOT, "coasters.json"), compact(coasters));
  console.log(`  coasters.json  <- ${coasters.coasters.length} coasters`);

  const parks = await getJSON("/api/parks");       // { "<Park>": {lat,lon,region} }
  await writeFile(join(ROOT, "parks.json"), compact(parks));
  console.log(`  parks.json     <- ${Object.keys(parks).length} parks`);

  let slugs = FALLBACK_SLUGS, fromApi = false;
  try {
    const u = await getJSON("/api/users");
    if (u.users && u.users.length) { slugs = u.users.map((x) => x.slug); fromApi = true; }
  } catch (e) {
    console.log("  (no /api/users — falling back to the built-in rider list)");
  }

  for (const slug of slugs) {
    const user = await getJSON("/api/user/" + slug); // { user, rides|credits }
    // NOT the avatar. The key names an R2 object, and the upload path deletes
    // the previous object every time a rider replaces their picture — so a key
    // in a snapshot is a broken image from the rider's next upload onward, and
    // a page falling back to the snapshot would draw a broken picture rather
    // than the initial-in-a-circle it draws when there is no picture at all.
    // The snapshot is a safety net; this was the one field in it that rotted
    // into a visible fault (found 2026-09-21).
    delete user.avatar;
    const n = (user.rides || user.credits || []).length;
    await writeFile(join(ROOT, slug + ".json"), compact(user));
    console.log(`  ${slug}.json`.padEnd(17) + `<- ${n} ${user.rides ? "rides" : "credits"}`);
  }

  // A rider who renames (claiming picks a new username) gets a new file, and
  // the old one used to sit here frozen for ever — four of them did until
  // 2026-09-25. Delete any rider file whose slug the API no longer lists. A
  // rider file is recognised by its shape ({user, rides}), never by name, so
  // coasters.json, parks.json and map-cities.json are never touched.
  // ONLY when the list came from the API: the built-in fallback list is old,
  // and pruning against it would delete every current rider's file.
  const keep = new Set(slugs.map((x) => x + ".json"));
  for (const f of fromApi ? await readdir(ROOT) : []) {
    if (!f.endsWith(".json") || keep.has(f)) continue;
    let j = null;
    try { j = JSON.parse(await readFile(join(ROOT, f), "utf8")); } catch (e) { continue; }
    if (j && typeof j === "object" && !Array.isArray(j) && "user" in j && Array.isArray(j.rides)) {
      await unlink(join(ROOT, f));
      console.log(`  ${f}`.padEnd(17) + "<- removed (no rider has this slug now)");
    }
  }

  console.log("Done. Review `git diff`, then commit if it looks right.");
}

main().catch((e) => { console.error("Sync failed:", e.message); process.exit(1); });
