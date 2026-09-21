#!/usr/bin/env node
/* Coaster Hub — fill the blank stats from Captain Coaster's public pages.
 *
 *   node tools/cc-stats.mjs              # fetch, match, write the migration + report
 *   node tools/cc-stats.mjs --dry-run    # everything but writing files
 *   node tools/cc-stats.mjs --selftest   # parse a built-in page and exit
 *   node tools/cc-stats.mjs --limit=25   # first 25 rows, to see it work
 *   node tools/cc-stats.mjs --only="Tatsu"   # one coaster, by name
 *
 * RUNS ON YOUR MACHINE, NOT IN THE SANDBOX. captaincoaster.com is one of the
 * hosts the Claude sandbox cannot reach, so this is a tool you run from the
 * repo root with Node 18+ and no npm install. It needs no API key: Captain
 * Coaster's API is behind a key they hand out by hand (asked, never answered),
 * but every coaster PAGE is public and prints the same stats. This reads those.
 *
 * WHAT IT DOES
 *   1. Takes every row in coasters.json that is missing any of
 *      type h s l inv yr manu model, grouped by park.
 *   2. For each park, asks their public search for the park, fetches the PARK
 *      page once — it lists every coaster at the park with id, slug and the
 *      real name — and matches our rows by normalised name within that park.
 *      Park first, then name: "Wacky Worm" is at ten parks and a name alone
 *      cannot tell them apart, but a name within a park can. A row the park
 *      page does not know is tried once more through the coaster search,
 *      filtered to the same park, which also knows former names.
 *      (The first version matched sitemap SLUGS. Their slugs are uniquified —
 *      cyclone, cyclone-1, cyclone-2 — so that found one Cyclone in the whole
 *      site and 5 of 631 rows overall. Never match on a slug.)
 *   3. Fetches each matched coaster page, one a second, with ?setUnits=metric
 *      so the numbers are the integers Captain Coaster stores rather than a
 *      rounded conversion, and converts to the site's ft / mph itself.
 *   4. Writes migrations/020-cc-stats.sql: one UPDATE per row, COALESCE on every
 *      column so it fills blanks and never overwrites a number somebody typed,
 *      matched on name + park as CLAUDE.md asks, safe to run twice. Plus
 *      tools/cc-stats-report.json saying what matched, what didn't, and why.
 *
 * Pages are cached in tools/.cc-cache/pages/ (gitignored), so a re-run after a
 * matching fix costs no requests. Delete the directory to refetch.
 *
 * WHAT IT DOES NOT DO
 *   It never touches D1. The migration goes through the usual path: dry-run in
 *   the sandbox against the snapshot, then Carter pastes
 *   `node tools/paste-sql.mjs migrations/020-cc-stats.sql` into the console.
 *   Manufacturer and model names are Captain Coaster's spellings; the report
 *   lists every distinct one so they can be reconciled with ours in /edit
 *   before the paste rather than after.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "tools", ".cc-cache", "pages");
const SITE = "https://captaincoaster.com";
const UA = "coasterhub.org stats backfill (github.com/crblanchard/coasterhub; polite, 1 req/s)";
const NEED = ["type", "h", "s", "l", "inv", "yr", "manu", "model"];

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));

// ---- the page --------------------------------------------------------------
// Captain Coaster's show page, as of its templates on 2026-09-21
// (templates/Coaster/show.html.twig in their repo). Stats are label/value
// spans; the rest are list-group items whose label ends in a colon and whose
// value is the next .pull-right. Labels are the ENGLISH translations — the
// page is fetched under /en/ — and listed here by meaning so a wording change
// is one edit.
const LABELS = {
  h: "Height", l: "Length", s: "Top speed", inv: "Inversions",
  manu: "Manufacturer", type: "Type", model: "Model", opening: "Opening date", closing: "Closing date",
};
const text = s => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function parsePage(html) {
  const out = {};
  // <span class="coaster-stats__label">Height</span><span class="coaster-stats__value ...">42 m</span>
  const stat = /coaster-stats__label">([^<]*)<\/span>\s*<span class="coaster-stats__value[^"]*">([\s\S]*?)<\/span>/g;
  for (let m; (m = stat.exec(html));) {
    const label = text(m[1]), val = text(m[2]);
    const num = val === "—" || val === "" ? null : Number((val.match(/[\d.,]+/) || [""])[0].replace(/,/g, ""));
    if (label === LABELS.h) out.h_m = num;
    else if (label === LABELS.l) out.l_m = num;
    else if (label === LABELS.s) out.s_kph = num;
    else if (label === LABELS.inv) out.inv = num;
  }
  // <label class="cc-field__label ...">Manufacturer :</label> <div class="pull-right">...</div>
  const item = /cc-field__label[^"]*">([\s\S]*?)<\/label>\s*<div[^>]*class="pull-right"[^>]*>([\s\S]*?)<\/div>/g;
  for (let m; (m = item.exec(html));) {
    const label = text(m[1]).replace(/\s*:\s*$/, ""), val = text(m[2]);
    const known = val && val !== "Unknown" ? val : null;
    if (label === LABELS.manu) out.manu = known;
    else if (label === LABELS.type) out.type = known;
    else if (label === LABELS.model) out.model = known;
    else if (label === LABELS.opening) Object.assign(out, dateOf(val, "opened"));
    else if (label === LABELS.closing) Object.assign(out, dateOf(val, "closed"));
  }
  // The park, from the breadcrumb link: <a href="/en/parks/123/slug">Park Name</a>
  const park = html.match(/href="[^"]*\/parks\/\d+\/[^"]*"[^>]*>([^<]+)<\/a>/);
  if (park) out.park = text(park[1]);
  const name = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (name) out.name = text(name[1]);
  return out;
}
// A park page: every coaster at the park, name inside the heading link, id and
// slug in its href. Unpaginated, unfiltered (ParkController passes them all).
export function parsePark(html) {
  const out = [];
  const row = /cc-media__heading[^>]*>\s*<a[^>]*href="[^"]*\/coasters\/(\d+)\/([^"?]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (let m; (m = row.exec(html));) out.push({ id: +m[1], slug: decodeURIComponent(m[2]), name: text(m[3]) });
  return out;
}
// Their displayDate: a bare year when the stored date is Jan 1 (their way of
// saying "year only"), otherwise a short localised date — under /en/ that is
// M/d/yy. Kept as the site keeps it: a full date with precision 'd', or a year
// with precision 'y'.
function dateOf(val, key) {
  const y = val.match(/^(\d{4})$/);
  if (y) return { [key]: y[1] + "-01-01", [key + "Prec"]: "y", [key + "Year"]: +y[1] };
  const d = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (d) {
    const yr = d[3].length === 2 ? (+d[3] < 40 ? 2000 + +d[3] : 1900 + +d[3]) : +d[3];
    const iso = yr + "-" + String(d[1]).padStart(2, "0") + "-" + String(d[2]).padStart(2, "0");
    return { [key]: iso, [key + "Prec"]: "d", [key + "Year"]: yr };
  }
  return {};
}
// Metric in, the site's units out. Rounded like the site's own numbers are.
const ft = m => m == null ? null : Math.round(m * 3.28084);
const mph = k => k == null ? null : Math.round(k * 0.621371);
const TYPE = { Steel: "Steel", Wood: "Wood", Wooden: "Wood", Hybrid: "Hybrid" };

// ---- matching --------------------------------------------------------------
// Names, normalised for comparison only: case, diacritics, punctuation, a
// leading "the", and a trailing "(...)" qualifier — ours say "(Red)" where
// theirs say "Red" or nothing.
export function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ").replace(/^the\s+/, "").replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const parkKey = p => norm(p).replace(/\b(theme|amusement|park|resort|world|land)\b/g, " ").replace(/\s+/g, " ").trim();

// ---- selftest --------------------------------------------------------------
const SAMPLE = `
<h1 class="cc-title">Tatsu</h1>
<a href="/en/parks/12/six-flags-magic-mountain">Six Flags Magic Mountain</a>
<div class="coaster-stats__row"><span class="coaster-stats__label">Height</span>
<span class="coaster-stats__value">52 m</span></div>
<div class="coaster-stats__row"><span class="coaster-stats__label">Length</span>
<span class="coaster-stats__value">1097 m</span></div>
<div class="coaster-stats__row"><span class="coaster-stats__label">Top speed</span>
<span class="coaster-stats__value">100 km/h</span></div>
<div class="coaster-stats__row"><span class="coaster-stats__label">Inversions</span>
<span class="coaster-stats__value">4</span></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Manufacturer
  :</label><div class="pull-right"><a href="/en/ranking?f=1">Bolliger &amp; Mabillard</a></div></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Type
  :</label><div class="pull-right"><a href="/x">Steel</a></div></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Model
  :</label><div class="pull-right"><a href="/x">Flying Coaster</a></div></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Restraint
  :</label><div class="pull-right">Flying restraint</div></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Opening date
  :</label><div class="pull-right"><a href="/x">5/13/06</a></div></div>
<div class="cc-list-group__item"><label class="cc-field__label m-0 text-semibold">Closing date
  :</label><div class="pull-right">2031</div></div>`;
const PARK_SAMPLE = `
<li class="cc-media"><div class="cc-media__start"><a href="/en/coasters/86/tatsu"><img></a></div>
<div class="cc-media__body"><h2 class="cc-media__heading mb-2 center" style="margin-bottom: -4px;">
  <a style="color:#333;" href="/en/coasters/86/tatsu">
      Tatsu
  </a></h2></div></li>
<li class="cc-media"><h2 class="cc-media__heading"><a href="/en/coasters/4091/x2-1">X2</a></h2></li>`;
if (args.selftest) {
  const rows = parsePark(PARK_SAMPLE);
  const okPark = rows.length === 2 && rows[0].id === 86 && rows[0].name === "Tatsu" && rows[1].slug === "x2-1" && rows[1].name === "X2";
  if (!okPark) { console.log("  FAIL park page: " + JSON.stringify(rows)); process.exit(1); }
  const p = parsePage(SAMPLE);
  const want = { name: "Tatsu", park: "Six Flags Magic Mountain", h_m: 52, l_m: 1097, s_kph: 100, inv: 4,
    manu: "Bolliger & Mabillard", type: "Steel", model: "Flying Coaster",
    opened: "2006-05-13", openedPrec: "d", closed: "2031-01-01", closedPrec: "y" };
  let bad = 0;
  for (const k of Object.keys(want)) if (p[k] !== want[k]) { bad++; console.log("  FAIL " + k + ": " + JSON.stringify(p[k]) + " want " + JSON.stringify(want[k])); }
  console.log(bad ? bad + " parse checks failed" : "parser ok: " + JSON.stringify({ h: ft(p.h_m), s: mph(p.s_kph), l: ft(p.l_m), inv: p.inv, yr: p.openedYear }));
  process.exit(bad ? 1 : 0);
}

// ---- fetching --------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FAILS = [];                          // every request that did not come back 200
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) { FAILS.push({ url, status: res.status }); throw new Error("HTTP " + res.status + " for " + url); }
  return res.text();
}
async function search(q) {
  // Under /en/ like every page: their attribute routes are all mounted at
  // /{_locale}, and without it this is a 404 — 448 of them, on the first run.
  const j = JSON.parse(await get(SITE + "/en/search/api?q=" + encodeURIComponent(q.slice(0, 100)) + "&limit=5"));
  await sleep(1000);
  return (j && j.results) || { coasters: [], parks: [] };
}
async function parkPage(id, slug) {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, "park-" + id + ".html");
  if (existsSync(f)) return readFileSync(f, "utf8");
  const html = await get(SITE + "/en/parks/" + id + "/" + slug);
  writeFileSync(f, html);
  await sleep(1000);
  return html;
}
async function page(id, slug) {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, id + ".html");
  if (existsSync(f)) return readFileSync(f, "utf8");
  const html = await get(SITE + "/en/coasters/" + id + "/" + slug + "?setUnits=metric");
  writeFileSync(f, html);
  await sleep(1000);                       // one a second, on purpose
  return html;
}

// ---- main ------------------------------------------------------------------
const coasters = JSON.parse(readFileSync(join(ROOT, "coasters.json"), "utf8")).coasters;
const todo = coasters.filter(c => NEED.some(k => c[k] == null || c[k] === ""))
  .filter(c => !args.only || norm(c.name) === norm(args.only))
  .slice(0, args.limit ? +args.limit : Infinity);
console.log(todo.length + " of " + coasters.length + " coasters are missing something in " + NEED.join(" "));

// ---- discovery: park first, then name within the park -----------------------
const byPark = new Map();
for (const c of todo) { if (!byPark.has(c.park)) byPark.set(c.park, []); byPark.get(c.park).push(c); }
console.log(byPark.size + " parks to look up");

const rows = [], report = { parks: {}, matched: [], unmatched: [], manufacturers: {}, models: {}, failures: FAILS };
// Their search is LIKE %q% on the name, five results, so ask with the name and
// then with the name stripped of the generic words if that finds nothing.
async function findPark(name) {
  const tries = [name, name.replace(/\s*\(.*\)\s*/g, " ").trim(), parkKey(name)].filter((t, i, a) => t.length >= 2 && a.indexOf(t) === i);
  for (const t of tries) {
    let res; try { res = await search(t); } catch (e) { continue; }
    const hit = (res.parks || []).find(p => parkKey(p.name) === parkKey(name))
             || ((res.parks || []).length === 1 && t === name ? res.parks[0] : null);
    if (hit) return hit;
  }
  return null;
}

let pn = 0;
for (const [park, ours] of byPark) {
  pn++;
  process.stdout.write("\r  park " + pn + "/" + byPark.size + "  " + park.padEnd(44).slice(0, 44));
  const hit = await findPark(park);
  if (!hit) {
    report.parks[park] = { found: false };
    ours.forEach(c => report.unmatched.push({ name: c.name, park: c.park, why: "park not found on the site" }));
    continue;
  }
  let listed;
  try { listed = parsePark(await parkPage(hit.id, hit.slug)); }
  catch (e) { report.parks[park] = { found: true, cc: hit.id, error: e.message }; ours.forEach(c => report.unmatched.push({ name: c.name, park: c.park, why: "park page failed: " + e.message })); continue; }
  report.parks[park] = { found: true, cc: hit.id, ccName: hit.name, coasters: listed.length };
  const byName = new Map(listed.map(r => [norm(r.name), r]));

  for (const c of ours) {
    let e = byName.get(norm(c.name)) || null;
    if (!e) {
      // Not under that name at the park: the coaster search knows former
      // names and returns the park with each hit, so a rename on either side
      // is not a dead end.
      try {
        const res = await search(c.name);
        const r = (res.coasters || []).find(r => r.subtitle && parkKey(r.subtitle) === parkKey(c.park));
        if (r) e = { id: r.id, slug: r.slug, name: r.name };
      } catch (err) { /* logged in FAILS */ }
    }
    if (!e) {
      report.unmatched.push({ name: c.name, park: c.park, why: "not at that park under that name",
        parkHas: listed.map(r => r.name).sort() });
      continue;
    }
    let p;
    try { p = parsePage(await page(e.id, e.slug)); }
    catch (err) { report.unmatched.push({ name: c.name, park: c.park, why: "coaster page failed: " + err.message, cc: e.id }); continue; }
    const fill = {
      type: c.type ? null : (TYPE[p.type] || null),
      h: c.h != null && c.h !== "" ? null : ft(p.h_m),
      s: c.s != null && c.s !== "" ? null : mph(p.s_kph),
      l: c.l != null && c.l !== "" ? null : ft(p.l_m),
      inv: c.inv != null && c.inv !== "" ? null : (p.inv ?? null),
      yr: c.yr ? null : (p.openedYear ?? null),
      opened: c.opened ? null : (p.opened ?? null),
      openedPrec: c.opened ? null : (p.openedPrec ?? null),
      closed: c.closed ? null : (p.closed ?? null),
      closedPrec: c.closed ? null : (p.closedPrec ?? null),
      manu: c.manu ? null : (p.manu ?? null),
      model: c.model ? null : (p.model ?? null),
    };
    if (p.manu) report.manufacturers[p.manu] = (report.manufacturers[p.manu] || 0) + 1;
    if (p.model) report.models[p.model] = (report.models[p.model] || 0) + 1;
    const sets = Object.entries(fill).filter(([, v]) => v != null);
    report.matched.push({ name: c.name, park: c.park, cc: e.id, ccName: e.name, fills: Object.fromEntries(sets) });
    if (sets.length) rows.push({ c, sets });
  }
}
const parksFound = Object.values(report.parks).filter(p => p.found).length;
console.log("\n" + parksFound + "/" + byPark.size + " parks found; " + report.matched.length + " coasters matched, " + report.unmatched.length + " not; " + rows.length + " rows get something; " + FAILS.length + " requests failed");

// ---- the migration ---------------------------------------------------------
const q = v => typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const sql = [
  "-- 020: coaster stats from Captain Coaster's public pages.",
  "-- Generated by tools/cc-stats.mjs on " + new Date().toISOString().slice(0, 10) + ".",
  "-- COALESCE on every column: fills a blank, never overwrites a number somebody",
  "-- typed. Matched on name + park, the visible things, so a second run is a no-op",
  "-- and a row that has since been renamed is simply not touched.",
  "-- Height and length in feet, speed in mph, converted from their metric integers.",
  "",
  ...rows.map(({ c, sets }) =>
    "UPDATE coasters SET " + sets.map(([k, v]) => k + " = COALESCE(" + k + ", " + q(v) + ")").join(", ")
    + " WHERE name = " + q(c.name) + " AND park = " + q(c.park) + ";"),
  "",
].join("\n");

if (args["dry-run"]) { console.log("\n--dry-run: not writing. First statements:\n" + sql.split("\n").slice(7, 12).join("\n")); process.exit(0); }
writeFileSync(join(ROOT, "migrations", "020-cc-stats.sql"), sql);
writeFileSync(join(ROOT, "tools", "cc-stats-report.json"), JSON.stringify(report, null, 1));
console.log("wrote migrations/020-cc-stats.sql (" + rows.length + " statements) and tools/cc-stats-report.json");
console.log("next: paste `node tools/paste-sql.mjs migrations/020-cc-stats.sql` into the D1 console —");
console.log("      after checking report.manufacturers / report.models against /edit's spellings.");
