// Build the alias table from data, not prose.
//
// Renames are read straight off the id (same row, new name). Merge targets are
// INFERRED: whoever held the removed row must have gained the surviving row, and
// the survivor is at the same park — that pins it without trusting my own commit
// messages. Anything that does not resolve to exactly one candidate is printed
// as UNRESOLVED rather than guessed at.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
// One-off backfill, kept for the record: it reconstructs the 2026-07-28/29/30
// renames and merges from the data files so the reasoning is auditable rather
// than a pile of INSERTs. The worker maintains coaster_aliases itself now, so
// this should not need running again.
//
//   node tools/build-aliases.mjs [base-commit]
//
const BASE = process.argv[2] || "5ff1671";   // last commit before the cleanup
const at = (rev, f) => JSON.parse(execSync(`git show ${rev}:${f}`, { encoding: "utf8", maxBuffer: 1 << 28 }));
const RIDERS = ["carter", "cole", "keltan", "max"];

// Same normalisation /add uses: case, every apostrophe lookalike, a leading
// article, punctuation — then optionally spaces too.
const norm = s => String(s || "").toLowerCase()
  .replace(/[‘’ʼ`´']/g, "").replace(/^(the|a)\s+/, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const squash = s => norm(s).replace(/ /g, "");

const oldC = at(BASE, "coasters.json").coasters, newC = at("HEAD", "coasters.json").coasters;
const o = new Map(oldC.map(c => [c.id, c])), n = new Map(newC.map(c => [c.id, c]));

// rider -> Set of coaster ids, at each revision. The old files used {credits:[{c}]}.
const setAt = (rev) => {
  const m = {};
  for (const r of RIDERS) {
    const u = at(rev, `${r}.json`);
    const rows = u.rides || u.credits || [];
    m[r] = new Set(rows.map(x => (typeof x === "object" ? x.c : x)));
  }
  return m;
};
const S0 = setAt(BASE), S1 = setAt("HEAD");

const byPark = new Map();
for (const c of newC) {
  if (!c.park) continue;
  if (!byPark.has(c.park)) byPark.set(c.park, []);
  byPark.get(c.park).push(c);
}

// park renames, derived from coasters whose id survived but whose park changed
const parkAlias = new Map();
for (const [id, c] of o) {
  const cur = n.get(id);
  if (cur && c.park && cur.park && c.park !== cur.park) parkAlias.set(c.park, cur.park);
}

const coasterAlias = [], unresolved = [];
for (const [id, c] of o) {
  const cur = n.get(id);
  if (cur) {                                        // survived: a rename if the name moved
    if (cur.name !== c.name) coasterAlias.push({ id, former: c.name, now: cur.name, park: cur.park, how: "rename" });
    continue;
  }
  // removed: infer where its riders went
  const park = parkAlias.get(c.park) || c.park;
  const here = new Set((byPark.get(park) || []).map(x => x.id));
  const holders = RIDERS.filter(r => S0[r].has(id));
  let cands = null;
  for (const r of holders) {
    const gained = new Set([...S1[r]].filter(x => !S0[r].has(x) && here.has(x)));
    cands = cands === null ? gained : new Set([...cands].filter(x => gained.has(x)));
  }
  cands = [...(cands || [])];
  if (cands.length === 1) {
    coasterAlias.push({ id: cands[0], fromId: id, former: c.name, now: n.get(cands[0]).name, park, how: "merge" });
    continue;
  }
  // Several coasters at one park were merged in the same batch, so the rider
  // gained several ids at once. Pin each by name against the candidates only —
  // a tiny, closed set, which makes this far safer than matching site-wide.
  if (cands.length > 1) {
    const q = squash(c.name);
    let hit = cands.filter(x => squash(n.get(x).name) === q);
    if (hit.length !== 1) hit = cands.filter(x => { const s = squash(n.get(x).name); return s.includes(q) || q.includes(s); });
    if (hit.length === 1) {
      coasterAlias.push({ id: hit[0], fromId: id, former: c.name, now: n.get(hit[0]).name, park, how: "merge+name" });
      continue;
    }
  }
  unresolved.push({ id, name: c.name, park: c.park, holders, cands: cands.map(x => x + ":" + n.get(x).name) });
}

// Hand-resolved leftovers: pairs name-matching cannot reach (a retheme, or a
// left/right split). Each is asserted against the inference's own candidate
// list, so a typo here cannot invent a mapping — it fails loudly instead.
const HAND = {
  617: 1143,   // Stardust Racers (Yellow) -> (Photon/Yellow)
  618: 1144,   // Stardust Racers (Green)  -> (Pulsar/Green)
  719: 644,    // Flying Ace Aerial Chase  -> Woodstock's Air Rail  (retheme)
  1009: 402,   // Wilde Beast              -> Wild Beast            (spelling)
  1042: 244,   // Matterhorn (Fantasyland, right) -> (Right)
  1043: 15,    // Matterhorn (Tomorrowland, left) -> (Left)
  1131: 65,    // Canyon Cruiser           -> Canyon Blaster        (retheme)
};
// 262 moved parks entirely (Springfield -> St. Louis), so it has no same-park
// candidate; resolved by name+park lookup instead.
const BY_NAME_PARK = { 262: ["Spinning Coaster", "St. Louis's Incredible Pizza Company"] };
// Deliberately left out: 728 (a junk name whose Seuss side is genuinely
// ambiguous) and 768 (a park correction, not a rename — the name never changed).

for (let i = unresolved.length - 1; i >= 0; i--) {
  const u = unresolved[i];
  let target = null;
  if (HAND[u.id] != null) {
    target = HAND[u.id];
    const ok = u.cands.some(s => Number(String(s).split(":")[0]) === target);
    if (!ok) throw new Error(`HAND[${u.id}] = ${target} is not among its candidates: ${u.cands}`);
  } else if (BY_NAME_PARK[u.id]) {
    const [nm, pk] = BY_NAME_PARK[u.id];
    const hit = newC.filter(c => c.name === nm && c.park === pk);
    if (hit.length !== 1) throw new Error(`BY_NAME_PARK[${u.id}] matched ${hit.length} coasters`);
    target = hit[0].id;
  }
  if (target == null) continue;
  coasterAlias.push({ id: target, fromId: u.id, former: u.name, now: n.get(target).name, park: n.get(target).park, how: "merge+hand" });
  unresolved.splice(i, 1);
}

// False positives the gain-inference cannot avoid: two SEPARATE wrong-park
// corrections that crossed at one park look exactly like a merge. Max's Miners
// Mike left Castle Park for Boomers! (El Cajon) in the same batch that his
// Little Dipper arrived at Castle Park from Six Flags Magic Mountain — he lost
// one id there and gained another, which is the merge fingerprint. It is not
// one. Keyed by the removed row's id so it cannot silently match something else.
const NOT_A_MERGE = new Set([767]);
for (let i = coasterAlias.length - 1; i >= 0; i--)
  if (coasterAlias[i].fromId != null && NOT_A_MERGE.has(coasterAlias[i].fromId)) coasterAlias.splice(i, 1);

const seen = new Set();
const clean = coasterAlias.filter(a => {
  // an alias that equals the current name teaches nothing
  const k = a.id + "|" + a.former.toLowerCase();
  if (a.former === a.now || seen.has(k)) return false;
  seen.add(k); return true;
}).sort((a, b) => a.now.localeCompare(b.now));

console.log(`## COASTER ALIASES (${clean.length})\n`);
console.log("| former name | is now | park | via |");
console.log("|---|---|---|---|");
for (const a of clean) console.log(`| ${a.former} | **${a.now}** | ${a.park} | ${a.how} |`);

console.log(`\n## PARK ALIASES (${parkAlias.size})\n`);
console.log("| former name | is now |");
console.log("|---|---|");
for (const [k, v] of parkAlias) console.log(`| ${k} | **${v}** |`);

console.log(`\n## UNRESOLVED (${unresolved.length}) — not written, needs a human`);
for (const u of unresolved) console.log(`  ${u.id} ${u.name} @ ${u.park}  holders=[${u.holders}] candidates=[${u.cands}]`);

const out = (process.env.S || ".") + "/alias-data.json";
writeFileSync(out, JSON.stringify({ coasters: clean, parks: [...parkAlias] }, null, 1));
console.log(`\nwrote ${out}`);
