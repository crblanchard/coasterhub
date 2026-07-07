#!/usr/bin/env node
/* Coaster Hub — Captain Coaster importer.
 *
 * Pulls the full Captain Coaster database (parks + coasters) via their API and
 * rebuilds the site's data files:
 *
 *   parks.json     { "<park name>": { lat, lon, region } }
 *   coasters.json  { "coasters": [ { id, name, park, loc, type, manu, model,
 *                                    h, s, l, inv, dur, laps, yr,
 *                                    opened, openedPrec, closed, closedPrec } ] }
 *
 * It uses Captain Coaster's own coaster IDs. Because your ride logs
 * (carter.json, cole.json, ...) reference coasters by the OLD local IDs, the
 * script also migrates every user file: it matches each old coaster by
 * name+park to its Captain Coaster counterpart and rewrites the `c` id. Rows it
 * can't match are reported and left untouched so nothing is silently dropped.
 *
 * LOCATION: Captain Coaster gives country + GPS but not US state. The `loc`
 * field is standardized as:
 *     US parks       -> "<State>, US"   (e.g. "California, US")
 *     everywhere else-> country name     (e.g. "France", "Japan")
 * US state is derived from each park's lat/lon via offline point-in-polygon
 * against a US-state boundary file (downloaded + cached on first run).
 *
 * LAPS / DURATION: Captain Coaster has no laps or duration data, so those come
 * from tools/coaster-overrides.json (your hand-entered values, keyed
 * "Name @ Park") plus anything already in coasters.json — preserved on every
 * re-import. Edit/append that file to add more laps or durations over time.
 *
 * ------------------------------------------------------------------ USAGE ----
 *   1. Get your API key from your Captain Coaster account settings.
 *   2. Run from the repo root:
 *
 *        CC_API_KEY=xxxxx node tools/import-captaincoaster.js
 *
 *   Useful flags:
 *     --dry-run        Fetch + report, but write nothing.
 *     --limit=N        Only fetch the first N coasters (fast smoke test).
 *     --no-migrate     Rebuild coasters/parks but leave user files alone.
 *     --concurrency=N  Parallel detail requests (default 5). Be polite.
 *     --delay=MS       Extra delay between detail requests (default 0).
 *     --out=DIR        Where to write JSON (default: repo root = ../ from tools).
 *
 * Captain Coaster stores metric units (m, km/h); the site uses ft / mph, so the
 * script converts. Requires Node 18+ (built-in fetch). No npm dependencies.
 */
"use strict";

const fs = require("fs");
const path = require("path");

// ---- config ----------------------------------------------------------------
const BASE = "https://captaincoaster.com/api";
const REPO_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(__dirname, ".cc-cache");
const STATES_CACHE = path.join(CACHE_DIR, "us-states.geojson");
// Classic Leaflet US-states polygons (50 states + DC), GeoJSON [lon,lat].
const STATES_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
// Your hand-entered laps/duration, keyed "Name @ Park". Applied over API data.
const OVERRIDES_PATH = path.join(__dirname, "coaster-overrides.json");

// ---- CLI parsing -----------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    dryRun: false, limit: Infinity, migrate: true, concurrency: 5,
    outDir: REPO_ROOT, delayMs: 0,
  };
  for (const a of argv) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--no-migrate") opts.migrate = false;
    else if (a.startsWith("--limit=")) opts.limit = parseInt(a.slice(8), 10) || Infinity;
    else if (a.startsWith("--concurrency=")) opts.concurrency = Math.max(1, parseInt(a.slice(14), 10) || 5);
    else if (a.startsWith("--delay=")) opts.delayMs = Math.max(0, parseInt(a.slice(8), 10) || 0);
    else if (a.startsWith("--out=")) opts.outDir = path.resolve(a.slice(6));
  }
  return opts;
}

// ---- unit + value helpers (pure, unit-tested) ------------------------------
const M_TO_FT = 3.28084;
const KMH_TO_MPH = 0.621371;
const round1 = (n) => Math.round(n * 10) / 10;
const round3 = (n) => Math.round(n * 1000) / 1000;
const metersToFeet = (m) => (m == null ? null : round1(m * M_TO_FT));
const kmhToMph = (k) => (k == null ? null : round1(k * KMH_TO_MPH));

// API Platform serializes relations either as a nested object (when its props
// are in the read group) or as a bare IRI string. Pull `.name` when we can.
function relName(rel) {
  if (rel == null) return null;
  if (typeof rel === "string") return null;                 // unresolved IRI
  if (typeof rel === "object" && typeof rel.name === "string") return rel.name || null;
  return null;
}

// "Wooden" -> "Wood", "Steel" -> "Steel", else pass through.
function normType(materialTypeName) {
  if (!materialTypeName) return null;
  const n = String(materialTypeName).trim();
  if (/^wood/i.test(n)) return "Wood";
  if (/^steel/i.test(n)) return "Steel";
  return n;
}

// CC dates are ISO date/datetime (or null). Return {date, prec, year}.
function parseDate(iso) {
  if (!iso) return { date: null, prec: null, year: null };
  const d = String(iso).slice(0, 10);
  const year = parseInt(d.slice(0, 4), 10) || null;
  return { date: d, prec: "day", year };
}

const isUSA = (country) => !!country && /^(the )?(united states|usa|u\.s\.a?\.?)( of america)?$/i.test(String(country).trim());

// ---- US-state point-in-polygon (pure, unit-tested) -------------------------
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pointInPolygon(lon, lat, geom) {
  if (!geom) return false;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (!poly || !poly.length) continue;
    if (pointInRing(lon, lat, poly[0])) {
      let inHole = false;
      for (let h = 1; h < poly.length; h++) if (pointInRing(lon, lat, poly[h])) { inHole = true; break; }
      if (!inHole) return true;
    }
  }
  return false;
}
// features: array of {properties:{name}, geometry, _bbox}. Returns state name or null.
function usStateOf(lat, lon, features) {
  if (lat == null || lon == null || !features) return null;
  for (const f of features) {
    const b = f._bbox;
    if (b && (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3])) continue; // bbox reject
    if (pointInPolygon(lon, lat, f.geometry)) return (f.properties && (f.properties.name || f.properties.NAME)) || null;
  }
  return null;
}
function bboxOf(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const scan = (ring) => ring.forEach(([x, y]) => {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  });
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  polys.forEach((poly) => poly.forEach(scan));
  return [minX, minY, maxX, maxY];
}

// Standardized location label for a park.
function resolveRegion(country, lat, lon, stateFeatures) {
  if (isUSA(country)) {
    const st = usStateOf(lat, lon, stateFeatures);
    return st ? `${st}, US` : "United States";
  }
  return country || null;
}

// Map one Captain Coaster coaster detail object -> local record (region/laps/dur added later).
function mapCoaster(cc) {
  const parkName = relName(cc.park) || (cc.park && cc.park.name) || null;
  const open = parseDate(cc.openingDate);
  const close = parseDate(cc.closingDate);
  return {
    id: cc.id,
    name: cc.name || "",
    park: parkName,
    loc: null,                              // filled from resolved park region
    type: normType(relName(cc.materialType)),
    manu: relName(cc.manufacturer),
    model: relName(cc.model),
    h: metersToFeet(cc.height),
    s: kmhToMph(cc.speed),
    l: metersToFeet(cc.length),
    inv: cc.inversionsNumber == null ? 0 : cc.inversionsNumber,
    dur: null,                              // from overrides / carryover
    laps: null,                             // from overrides / carryover
    yr: open.year,
    opened: open.date,
    openedPrec: open.prec,
    closed: close.date,
    closedPrec: close.prec,
  };
}

// ---- Hydra pagination fetch ------------------------------------------------
async function apiGet(urlPath, apiKey) {
  const url = urlPath.startsWith("http") ? urlPath : BASE + urlPath;
  const res = await fetch(url, { headers: { Authorization: apiKey, Accept: "application/ld+json" } });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Auth failed (${res.status}). Check CC_API_KEY / your Captain Coaster API key.`);
  }
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}
async function fetchCollection(firstPath, apiKey, onProgress) {
  const out = [];
  let next = firstPath;
  while (next) {
    const page = await apiGet(next, apiKey);
    for (const m of (page["hydra:member"] || page.member || [])) out.push(m);
    if (onProgress) onProgress(out.length);
    const view = page["hydra:view"] || page.view || {};
    next = view["hydra:next"] || view.next || null;
  }
  return out;
}

// ---- US states loader (fetch once, cache) ----------------------------------
async function loadUsStates() {
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(STATES_CACHE, "utf8")); } catch { /* fetch below */ }
  if (!raw) {
    try {
      const res = await fetch(STATES_URL);
      if (!res.ok) throw new Error(`states file -> ${res.status}`);
      raw = await res.json();
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(STATES_CACHE, JSON.stringify(raw));
    } catch (e) {
      console.warn(`  ! Could not load US-state boundaries (${e.message}). US parks fall back to "United States".`);
      return [];
    }
  }
  return (raw.features || []).map((f) => ({
    properties: f.properties, geometry: f.geometry, _bbox: bboxOf(f.geometry),
  }));
}

// ---- cache (resume-friendly) -----------------------------------------------
const cachePath = (id) => path.join(CACHE_DIR, `coaster-${id}.json`);
function readCache(id) { try { return JSON.parse(fs.readFileSync(cachePath(id), "utf8")); } catch { return null; } }
function writeCache(id, data) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(cachePath(id), JSON.stringify(data)); } catch { /* best-effort */ }
}

// ---- key + migration (pure, unit-tested) -----------------------------------
function normKey(name, park) {
  const n = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  return n(name) + "|" + n(park);
}
function buildIdMap(oldCoasters, newCoasters) {
  const newByKey = new Map();
  for (const c of newCoasters) { const k = normKey(c.name, c.park); if (!newByKey.has(k)) newByKey.set(k, c.id); }
  const map = new Map(); const unmatched = [];
  for (const c of oldCoasters) {
    const k = normKey(c.name, c.park);
    if (newByKey.has(k)) map.set(c.id, newByKey.get(k)); else unmatched.push({ id: c.id, name: c.name, park: c.park });
  }
  return { map, unmatched };
}

// Build laps/dur to preserve, keyed by normKey(name, park).
// Precedence: overrides file wins, else carry over existing coasters.json values.
function buildPreserved(oldCoasters, overridesObj) {
  const map = new Map();
  const set = (k, v) => {
    if (!v) return;
    const cur = map.get(k) || {};
    if (v.laps != null) cur.laps = v.laps;
    if (v.dur != null) cur.dur = v.dur;
    if (Object.keys(cur).length) map.set(k, cur);
  };
  for (const c of (oldCoasters || [])) {            // 1) carry over (laps>1, any dur)
    const v = {};
    if (c.laps != null && c.laps !== 1) v.laps = c.laps;
    if (c.dur != null) v.dur = c.dur;
    set(normKey(c.name, c.park), v);
  }
  const entries = (overridesObj && overridesObj.overrides) || {};
  for (const [key, v] of Object.entries(entries)) { // 2) overrides file wins
    const parts = key.split(" @ ");
    const name = parts[0], park = parts.slice(1).join(" @ ");
    set(normKey(name, park), { laps: v.laps, dur: v.dur });
  }
  return map;
}

function migrateUserFile(userObj, idMap) {
  const miss = new Set();
  const remapC = (c) => (idMap.has(c) ? idMap.get(c) : (miss.add(c), c));
  const clone = JSON.parse(JSON.stringify(userObj));
  if (Array.isArray(clone.rides)) clone.rides.forEach((r) => { if (r && r.c != null) r.c = remapC(r.c); });
  if (Array.isArray(clone.credits)) {
    clone.credits = clone.credits.map((item) =>
      (typeof item === "object" && item && item.c != null) ? Object.assign({}, item, { c: remapC(item.c) }) : item);
  }
  return { migrated: clone, missing: [...miss] };
}

// ---- IO helpers ------------------------------------------------------------
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function writeJSONSafe(p, obj, dryRun) {
  if (dryRun) { console.log(`  [dry-run] would write ${path.basename(p)}`); return; }
  if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
  fs.writeFileSync(p, JSON.stringify(obj));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- main ------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.CC_API_KEY || process.env.CAPTAIN_COASTER_API_KEY;
  if (!apiKey) {
    console.error("ERROR: set CC_API_KEY to your Captain Coaster API key.\n" +
      "  CC_API_KEY=xxxxx node tools/import-captaincoaster.js");
    process.exit(1);
  }

  const coastersPath = path.join(opts.outDir, "coasters.json");
  const parksPath = path.join(opts.outDir, "parks.json");

  // Snapshot OLD coasters up front (for migration + laps/dur carryover).
  let oldCoasters = [];
  try { oldCoasters = readJSON(coastersPath).coasters || []; } catch { /* first run */ }

  // Load laps/duration to preserve (overrides file + carryover from old data).
  let overridesObj = null;
  try { overridesObj = readJSON(OVERRIDES_PATH); } catch { /* optional */ }
  const preserved = buildPreserved(oldCoasters, overridesObj);
  console.log(`Preserving laps/duration for ${preserved.size} coasters (overrides + carryover).`);

  // 0) US-state boundaries ------------------------------------------------
  console.log("Loading US-state boundaries…");
  const stateFeatures = await loadUsStates();
  console.log(`  ${stateFeatures.length} state polygons ready.`);

  // 1) Parks --------------------------------------------------------------
  console.log("Fetching parks…");
  const parkMembers = await fetchCollection("/parks", apiKey, (n) => process.stdout.write(`\r  parks: ${n}`));
  process.stdout.write("\n");
  const parkInfo = new Map();     // name -> {lat, lon, country, region}
  for (const p of parkMembers) {
    if (!p || !p.name) continue;
    const lat = p.latitude == null ? null : round3(p.latitude);
    const lon = p.longitude == null ? null : round3(p.longitude);
    const country = p.country ? (relName(p.country) || p.country.name || null) : null;
    parkInfo.set(p.name, { lat, lon, country, region: resolveRegion(country, lat, lon, stateFeatures) });
  }

  // 2) Coaster list -------------------------------------------------------
  console.log("Fetching coaster list…");
  let listMembers = await fetchCollection("/coasters", apiKey, (n) => process.stdout.write(`\r  coasters listed: ${n}`));
  process.stdout.write("\n");
  console.log(`  ${listMembers.length} coasters in the Captain Coaster database.`);
  if (opts.limit !== Infinity) listMembers = listMembers.slice(0, opts.limit);
  console.log(`  ${listMembers.length} to detail this run.`);

  // 3) Coaster details (concurrent, cached) ------------------------------
  const details = new Array(listMembers.length);
  let done = 0, fetched = 0, cached = 0, failed = 0;
  const queue = listMembers.map((m, i) => ({ id: m.id, i }));
  async function worker() {
    while (queue.length) {
      const { id, i } = queue.shift();
      let data = readCache(id);
      if (data) cached++;
      else {
        try { data = await apiGet(`/coasters/${id}`, apiKey); writeCache(id, data); fetched++; if (opts.delayMs) await sleep(opts.delayMs); }
        catch (e) { failed++; data = null; console.error(`\n  ! coaster ${id}: ${e.message}`); }
      }
      details[i] = data; done++;
      if (done % 25 === 0 || done === listMembers.length) {
        process.stdout.write(`\r  detailed: ${done}/${listMembers.length} (net ${fetched}, cache ${cached}, fail ${failed})`);
      }
    }
  }
  await Promise.all(Array.from({ length: opts.concurrency }, worker));
  process.stdout.write("\n");

  // 4) Map + attach region + preserve laps/dur ---------------------------
  const newCoasters = [];
  for (const cc of details) {
    if (!cc || cc.id == null) continue;
    const rec = mapCoaster(cc);
    const pinfo = rec.park && parkInfo.get(rec.park);
    if (pinfo) rec.loc = pinfo.region;
    else if (cc.park && cc.park.country) rec.loc = resolveRegion(relName(cc.park.country) || cc.park.country.name, null, null, stateFeatures);
    const pres = preserved.get(normKey(rec.name, rec.park));   // keep hand-entered laps/dur
    if (pres) { if (pres.laps != null) rec.laps = pres.laps; if (pres.dur != null) rec.dur = pres.dur; }
    newCoasters.push(rec);
  }
  newCoasters.sort((a, b) => a.id - b.id);
  console.log(`Built ${newCoasters.length} coaster records.`);
  const keptLaps = newCoasters.filter((c) => c.laps != null).length;
  const keptDur = newCoasters.filter((c) => c.dur != null).length;
  console.log(`  laps kept on ${keptLaps}, durations kept on ${keptDur}.`);

  const usStates = new Set(), countries = new Set();
  for (const c of newCoasters) {
    if (!c.loc) continue;
    if (/, US$/.test(c.loc)) usStates.add(c.loc); else countries.add(c.loc);
  }
  console.log(`  locations: ${usStates.size} US states + ${countries.size} countries.`);

  // 5) parks.json (only parks that have coasters) ------------------------
  const usedParks = new Set(newCoasters.map((c) => c.park).filter(Boolean));
  const parksOut = {};
  for (const name of [...usedParks].sort()) {
    parksOut[name] = { lat: p.lat ?? null, lon: p.lon ?? null, region: p.region ?? null };
  }

  // 6) Write --------------------------------------------------------------
  console.log(opts.dryRun ? "Dry run — no files written:" : "Writing data files…");
  writeJSONSafe(coastersPath, { coasters: newCoasters }, opts.dryRun);
  writeJSONSafe(parksPath, parksOut, opts.dryRun);

  // 7) Migrate user files -------------------------------------------------
  if (opts.migrate) {
    if (!oldCoasters.length) {
      console.log("Skipping user-file migration (no previous coasters.json to map from).");
    } else {
      const { map, unmatched } = buildIdMap(oldCoasters, newCoasters);
      console.log(`Migrating user files: ${map.size}/${oldCoasters.length} old coasters matched to Captain Coaster IDs.`);
      if (unmatched.length) {
        console.log(`  ${unmatched.length} old coasters had no CC match (ride refs left as-is):`);
        for (const u of unmatched.slice(0, 40)) console.log(`    - #${u.id} ${u.name} @ ${u.park}`);
        if (unmatched.length > 40) console.log(`    …and ${unmatched.length - 40} more`);
      }
      const userFiles = fs.readdirSync(opts.outDir)
        .filter((f) => /\.json$/.test(f) && !["coasters.json", "parks.json"].includes(f))
        .filter((f) => { try { const o = readJSON(path.join(opts.outDir, f)); return o && (o.rides || o.credits); } catch { return false; } });
      for (const f of userFiles) {
        const fp = path.join(opts.outDir, f);
        const { migrated, missing } = migrateUserFile(readJSON(fp), map);
        console.log(`  ${f}: remapped${missing.length ? `, ${missing.length} unmatched ids: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? "…" : ""}` : " cleanly"}`);
        writeJSONSafe(fp, migrated, opts.dryRun);
      }
    }
  }

  console.log(opts.dryRun ? "Done (dry run)." : "Done.");
}

module.exports = {
  metersToFeet, kmhToMph, normType, parseDate, relName, mapCoaster,
  normKey, buildIdMap, migrateUserFile, parseArgs, buildPreserved,
  pointInRing, pointInPolygon, usStateOf, bboxOf, resolveRegion, isUSA,
};

if (require.main === module) {
  main().catch((e) => { console.error("\nFATAL:", e.message); process.exit(1); });
}
