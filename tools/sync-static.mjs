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
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.argv[2] || "https://coasterhub.org").replace(/\/$/, "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Riders to sync. Keep in step with the USERS array in app.js.
const SLUGS = ["carter", "cole", "keltan", "max"];

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

  for (const slug of SLUGS) {
    const user = await getJSON("/api/user/" + slug); // { user, rides|credits }
    const n = (user.rides || user.credits || []).length;
    await writeFile(join(ROOT, slug + ".json"), compact(user));
    console.log(`  ${slug}.json`.padEnd(17) + `<- ${n} ${user.rides ? "rides" : "credits"}`);
  }

  console.log("Done. Review `git diff`, then commit if it looks right.");
}

main().catch((e) => { console.error("Sync failed:", e.message); process.exit(1); });
