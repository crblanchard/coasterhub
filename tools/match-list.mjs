#!/usr/bin/env node
/* What of somebody else's credit list do we already have?
 *
 *   node tools/match-list.mjs <file>            — the report
 *   node tools/match-list.mjs <file> --import   — a paste for /import
 *
 * Coaster-count and the rest export a person's ridden list as text, and the
 * question before importing it is always the same: which of these are coasters
 * we hold, and which are missing. This answers it against `coasters.json` —
 * the repo's snapshot of D1, refreshed by the sync workflow — and prints the
 * two lists, because an unmatched line is work to do, not a line to drop.
 *
 * It parses the shape coaster-count's "ridden" page pastes into:
 *
 *     Sweden                        <- a country: ignored
 *     Coaster  Classification  Credit   <- a repeated table header: ignored
 *     Gröna Lund - Stockholm        <- "<park> - <city>"
 *     Vilda Musen1 /2    2018-07-15 <- "<name><tracks ridden> /<tracks>"
 *
 * ...and the ordinary shapes too: a park heading with coasters under it, or two
 * tab-separated columns. Anything with a tab is a coaster line; a line with no
 * tab and a " - " in it opens a park.
 *
 * The markers it strips, and why they are markers rather than names:
 *   *          coaster-count's "no longer operating" / annotation star
 *   1 /2       tracks ridden of tracks available — one digit, then a slash, so
 *              "Top Thrill 22 /2" keeps its 2 and loses the "2 /2"
 *   (-2006)    the year it closed
 *
 * What it does NOT do is guess a park. A park is matched by name (and by the
 * former names in `parkAliases`), and a coaster only ever matches WITHIN a park
 * it has resolved — the same rule /import follows, and for the same reason:
 * "Batman: The Ride" is a different ride at nine parks.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
const wantImport = process.argv.includes("--import");
if (!file) {
  console.error("usage: node tools/match-list.mjs <file> [--import]");
  process.exit(2);
}

// ---- the database ----------------------------------------------------------
// --db lets it run against a newer snapshot than the repo's own, for the gap
// between somebody adding coasters and the sync workflow committing them.
const dbArg = (process.argv.find((a) => a.startsWith("--db=")) || "").slice(5);
const db = JSON.parse(readFileSync(dbArg || join(ROOT, "coasters.json"), "utf8"));
const COASTERS = db.coasters || [];
const ALIASES = db.aliases || [];          // {c: coasterId, n: formerName}
const PARK_ALIASES = db.parkAliases || []; // {p: park, n: formerName}

// Compared without case, accents, punctuation or the words that are noise in a
// ride's name. "Superman - Ride Of Steel" and "Superman: Ride of Steel" are the
// same ride typed by two people.
const norm = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[’‘`]/g, "'")
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
// A second, looser key for the last resort: no spaces, no "the".
const tight = (s) => norm(s).replace(/\bthe\b/g, "").replace(/\s+/g, "");

const byPark = new Map();                  // normalised park -> coasters
for (const c of COASTERS) {
  const k = norm(c.park);
  if (!byPark.has(k)) byPark.set(k, []);
  byPark.get(k).push(c);
}
const parkAliasOf = new Map();             // former name -> current park
for (const a of PARK_ALIASES) parkAliasOf.set(norm(a.n), a.p);
const aliasOf = new Map();                 // former ride name -> coaster id
for (const a of ALIASES) aliasOf.set(norm(a.n), a.c);

// ---- parsing ---------------------------------------------------------------
const stripMarks = (s) => String(s)
  .replace(/\s*\(-\d{4}\)\s*/g, " ")       // (-2006): the year it closed
  .replace(/\s*\d\s*\/\s*\d+\s*$/, "")     // 1 /2: tracks ridden of tracks
  .replace(/\s*\*+\s*$/, "")               // the annotation star
  .replace(/\s+/g, " ")
  .trim();

function parse(text) {
  const out = [];
  let park = null;
  for (const raw of String(text).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (/^\s*coaster\t/i.test(line)) continue;              // the table header
    if (line.includes("\t")) {
      const cells = line.split("\t");
      const name = stripMarks(cells[0]);
      // The last cell is the date the credit was taken, "No date", or a bare
      // year. A bare year is not a day, and a made-up day is worse than none:
      // it would put the ride on a calendar on a date nobody rode it.
      const when = (cells[cells.length - 1] || "").trim();
      const d = /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : null;
      if (name) out.push({ name, park, d, raw: cells[0].trim() });
      continue;
    }
    const head = stripMarks(line.replace(/\s*\*\s*/g, " "));
    if (/ - /.test(head)) {
      // "<park> - <city>", and Disney's two-level names have two dashes, so the
      // city is what follows the LAST one.
      park = head.slice(0, head.lastIndexOf(" - ")).trim();
    }
    // Anything else with no tab and no dash is a country heading: skipped.
  }
  return out;
}

// ---- matching --------------------------------------------------------------
function parkCandidates(name) {
  const out = [name];
  if (name.includes(" - ")) {
    out.push(name.slice(name.indexOf(" - ") + 3));          // "Disney's Animal Kingdom"
    out.push(name.slice(0, name.indexOf(" - ")));           // "Walt Disney World"
  }
  return out;
}
function findPark(name) {
  for (const cand of parkCandidates(name)) {
    const k = norm(cand);
    if (byPark.has(k)) return { park: cand, rows: byPark.get(k) };
    if (parkAliasOf.has(k)) {
      const cur = parkAliasOf.get(k);
      if (byPark.has(norm(cur))) return { park: cur, rows: byPark.get(norm(cur)), via: cand };
    }
  }
  // One last try: a park whose name contains the candidate or vice versa, and
  // only when exactly one does — "Adventureland" must not silently become
  // "Adventureland Resort".
  for (const cand of parkCandidates(name)) {
    const k = norm(cand);
    const hits = [...byPark.keys()].filter((p) => p.includes(k) || k.includes(p));
    if (hits.length === 1) return { park: hits[0], rows: byPark.get(hits[0]), loose: true };
  }
  return null;
}

// Within a park: the name as written, then a former name, then the name with
// its parenthetical removed, then a close match. Every step is anchored to a
// park that has already resolved.
const bareOf = (s) => stripMarks(String(s).replace(/\s*\([^)]*\)\s*/g, " "));
const parenOf = (s) => (String(s).match(/\(([^)]*)\)/) || [])[1] || "";

function findRide(name, rows) {
  const n = norm(name);
  let hit = rows.find((c) => norm(c.name) === n);
  if (hit) return { c: hit, how: "exact" };

  const aliasId = aliasOf.get(n);
  if (aliasId) {
    hit = rows.find((c) => c.id === aliasId);
    if (hit) return { c: hit, how: "former name" };
  }

  // "Gemini (Blue)" is one side of Gemini; "Space Mountain (Left, Alpha)" is
  // one of two Space Mountains we hold SEPARATELY. So when the bare name hits
  // more than one row, the words in the brackets are what tell them apart —
  // without that step the two Magic Kingdom Space Mountains looked like two
  // coasters we did not have.
  const bare = bareOf(name), nb = norm(bare);
  if (nb !== n) {
    const bareHits = rows.filter((c) => norm(bareOf(c.name)) === nb || norm(c.name) === nb);
    if (bareHits.length === 1) return { c: bareHits[0], how: "one side of " + bareHits[0].name };
    if (bareHits.length > 1) {
      const words = norm(parenOf(name)).split(" ").filter(Boolean);
      const pick = bareHits.filter((c) => {
        const theirs = norm(c.name).split(" ");
        return words.some((w) => theirs.includes(w));
      });
      if (pick.length === 1) return { c: pick[0], how: "matched on (" + parenOf(name) + ")" };
      return { c: null, near: bareHits, why: "several rows called " + bare };
    }
    const aid = aliasOf.get(nb);
    if (aid) {
      hit = rows.find((c) => c.id === aid);
      if (hit) return { c: hit, how: "former name, one side" };
    }
  }

  const t = tight(bare);
  hit = rows.find((c) => tight(c.name) === t);
  if (hit) return { c: hit, how: "close" };

  // One name STARTS the other, on a word boundary: "Rock 'n' Roller Coaster"
  // against "Rock 'n Roller Coaster Starring The Muppets" — the same ride with
  // a retheme bolted onto the end.
  //
  // A prefix, not containment anywhere: "Son Of Beast" ENDS with "Beast" and is
  // a different coaster, gone since 2009, which plain containment cheerfully
  // called the same thing.
  const nn = norm(bare);
  const near = rows.filter((c) => {
    const o = norm(c.name);
    return o === nn || o.startsWith(nn + " ") || nn.startsWith(o + " ");
  });
  if (near.length === 1) return { c: near[0], how: "close" };
  return { c: null, near: near.length ? near : rows };
}

// ---- run -------------------------------------------------------------------
const rows = parse(readFileSync(file, "utf8"));
const have = [], missing = [], noPark = new Map();
const seen = new Set();
let dupes = 0;

for (const r of rows) {
  if (!r.park) { missing.push({ ...r, why: "no park heading above it" }); continue; }
  const p = findPark(r.park);
  if (!p) {
    if (!noPark.has(r.park)) noPark.set(r.park, []);
    noPark.get(r.park).push(r);
    missing.push({ ...r, why: "park not in the database" });
    continue;
  }
  const m = findRide(r.name, p.rows);
  if (!m.c) {
    missing.push({ ...r, park: p.park, why: "not at " + p.park });
    continue;
  }
  const key = m.c.id;
  if (seen.has(key)) { dupes++; have.push({ ...r, c: m.c, how: m.how, dupe: true }); continue; }
  seen.add(key);
  have.push({ ...r, c: m.c, how: m.how });
}

const pad = (s, n) => String(s).padEnd(n);

// --rides: the payload /api/rides takes, one call per date. Dated credits stay
// dated — the site's timelines, day views and on-this-day all read `d`, and
// flattening a list that HAS dates into undated rows throws that away for good.
if (process.argv.includes("--rides")) {
  const byDate = new Map();
  for (const h of have) {
    const k = h.d || "";
    if (!byDate.has(k)) byDate.set(k, new Set());
    byDate.get(k).add(h.c.id);            // a Set: two tracks of one coaster on
  }                                       // one day is one ride of one coaster
  const outRows = [...byDate.entries()]
    .sort((a, b) => (a[0] ? 1 : -1) - (b[0] ? 1 : -1) || String(a[0]).localeCompare(b[0]))
    .map(([d, ids]) => ({ d: d || null, ids: [...ids].sort((x, y) => x - y) }));
  console.log(JSON.stringify(outRows));
  process.exit(0);
}
if (wantImport) {
  // Ready to paste into /import: park heading, then its coasters, our spelling.
  let park = null;
  for (const h of have) {
    if (h.c.park !== park) { park = h.c.park; console.log("\n" + park); }
    console.log(h.c.name);
  }
  process.exit(0);
}

console.log("READ " + rows.length + " lines of credits");
console.log("  in the database : " + have.length + "  (" + seen.size + " distinct coasters"
  + (dupes ? ", " + dupes + " of the lines are second tracks of one we already counted" : "") + ")");
console.log("  missing         : " + missing.length);

console.log("\n================ WE HAVE THESE ================");
let park = null;
for (const h of have) {
  if (h.c.park !== park) { park = h.c.park; console.log("\n" + park); }
  console.log("  " + pad(h.raw, 40)
    + (norm(h.raw) === norm(h.c.name) ? "" : "-> " + h.c.name)
    + (h.how !== "exact" ? "   [" + h.how + "]" : "")
    + (h.dupe ? "   [same coaster as the line above]" : ""));
}

console.log("\n================ WE DO NOT HAVE THESE ================");
let last = null;
for (const m of missing) {
  if (m.park !== last) { last = m.park; console.log("\n" + (m.park || "(no park)")); }
  console.log("  " + pad(m.raw, 40) + m.why);
}

if (noPark.size) {
  console.log("\nParks with no row in the database at all:");
  for (const [p, list] of noPark) console.log("  " + pad(p, 44) + list.length + " coasters");
}
