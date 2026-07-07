#!/usr/bin/env node
/* Coaster Hub — friend CSV importer.
 *
 * Turns a friend's spreadsheet of coasters they've ridden into a user JSON file
 * the site can load (e.g. site loads it at ?user=alex -> fetches alex.json).
 *
 * Usage:
 *   node tools/import-credits.js <input.csv> <username> [output.json]
 *   e.g. node tools/import-credits.js alex.csv alex ../alex.json
 *
 * The CSV needs a coaster-name column. A park/location column is strongly
 * recommended (some coaster names — Batman, Superman — exist at many parks and
 * can't be told apart without it). An optional rides/count column unlocks the
 * ride-count stats. Header names are detected flexibly:
 *   name  <- "coaster" | "name" | "ride"
 *   park  <- "park" | "location"
 *   count <- "rides" | "count" | "times" | "#"
 *
 * Output shape:
 *   no counts : {"user":"Alex","credits":["id1","id2", ...]}
 *   w/ counts : {"user":"Alex","credits":[{"c":"id1","n":12}, ...]}
 *
 * It prints a report of matched / ambiguous / unmatched rows so you can send the
 * unmatched ones back to the friend to clean up. It never guesses blindly:
 * ambiguous or unknown rows are reported, not force-matched.
 */
"use strict";
const fs = require("fs");
const path = require("path");

// ---- tiny CSV parser (handles quotes, commas, CRLF) ------------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, q = false;
  text = text.replace(/^﻿/, ""); // strip BOM
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* ignore */ }
      else field += ch;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c.trim() !== ""));
}

// ---- normalization ---------------------------------------------------------
function norm(s) {
  return (s || "")
    .toString()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

function findCol(header, keys) {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (keys.some(k => h === k || h.includes(k))) return i;
  }
  return -1;
}

// Parse a date cell into ISO 'YYYY-MM-DD', or just 'YYYY' if only a year is given.
function parseDate(s) {
  s = (s || "").trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + "-" + m[2] + "-" + m[3];
  if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/))) {                 // M/D/YYYY
    return m[3] + "-" + String(m[1]).padStart(2, "0") + "-" + String(m[2]).padStart(2, "0");
  }
  if ((m = s.match(/^(\d{4})$/))) return m[1];                                     // year only
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
}

// ---- main ------------------------------------------------------------------
function main() {
  const [inCsv, username, outArg] = process.argv.slice(2);
  if (!inCsv || !username) {
    console.error("Usage: node tools/import-credits.js <input.csv> <username> [output.json]");
    process.exit(1);
  }
  const root = path.resolve(__dirname, "..");
  const coasters = JSON.parse(fs.readFileSync(path.join(root, "coasters.json"), "utf8")).coasters;

  // Index coasters by normalized name -> [coaster,...]
  const byName = {};
  coasters.forEach(c => { (byName[norm(c.name)] = byName[norm(c.name)] || []).push(c); });

  const rows = parseCSV(fs.readFileSync(inCsv, "utf8"));
  const header = rows[0];
  const iName = findCol(header, ["coaster", "name", "ride"]);
  const iPark = findCol(header, ["park", "location"]);
  const iCount = findCol(header, ["rides", "count", "times", "#", "laps"]);
  const iFirst = findCol(header, ["first", "ridden", "date"]);
  if (iName < 0) { console.error("Could not find a coaster-name column in the CSV header:", header); process.exit(1); }

  const credits = [];
  const seen = new Set();
  const matched = [], ambiguous = [], unmatched = [], dupes = [];
  let anyCount = false, anyFirst = false;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rawName = (cells[iName] || "").trim();
    if (!rawName) continue;
    const rawPark = iPark >= 0 ? (cells[iPark] || "").trim() : "";
    const rawCount = iCount >= 0 ? (cells[iCount] || "").trim() : "";
    const n = rawCount ? parseInt(rawCount.replace(/[^0-9]/g, ""), 10) : null;
    const first = iFirst >= 0 ? parseDate(cells[iFirst]) : null;

    let cands = byName[norm(rawName)] || [];
    // Fuzzy fallback: name contained either way (only if we can still disambiguate by park)
    if (cands.length === 0) {
      const nn = norm(rawName);
      cands = coasters.filter(c => { const cn = norm(c.name); return cn.includes(nn) || nn.includes(cn); });
    }
    // Narrow by park when we have candidates and a park value
    if (cands.length > 1 && rawPark) {
      const np = norm(rawPark);
      const narrowed = cands.filter(c => { const cp = norm(c.park); return cp === np || cp.includes(np) || np.includes(cp); });
      if (narrowed.length >= 1) cands = narrowed;
    }

    if (cands.length === 1) {
      const c = cands[0];
      if (seen.has(c.id)) { dupes.push(rawName + (rawPark ? " @ " + rawPark : "")); continue; }
      seen.add(c.id);
      const hasN = (n != null && !isNaN(n));
      if (hasN || first) {
        const o = { c: c.id };
        if (hasN) { o.n = n; anyCount = true; }
        if (first) { o.first = first; anyFirst = true; }
        credits.push(o);
      } else credits.push(c.id);
      matched.push(rawName + " -> " + c.name + " (" + c.park + ")");
    } else if (cands.length > 1) {
      ambiguous.push(rawName + (rawPark ? " @ " + rawPark : "") + "  [" + cands.length + " possible: " + cands.slice(0, 4).map(c => c.name + "/" + c.park).join(", ") + "]");
    } else {
      unmatched.push(rawName + (rawPark ? " @ " + rawPark : ""));
    }
  }

  // If some rows had counts and some didn't, normalize to the richest shape used.
  const out = { user: username.charAt(0).toUpperCase() + username.slice(1), credits };

  const outPath = outArg ? path.resolve(outArg) : path.join(root, username.toLowerCase() + ".json");
  fs.writeFileSync(outPath, JSON.stringify(out) + "\n");

  // ---- report ----
  console.log("\n=== Coaster Hub import: " + username + " ===");
  console.log("Columns detected -> name:#" + iName + (iPark >= 0 ? " park:#" + iPark : " park:(none)") + (iCount >= 0 ? " count:#" + iCount : " count:(none)") + (iFirst >= 0 ? " first:#" + iFirst : " first:(none)"));
  console.log("Matched:    " + matched.length);
  console.log("Ambiguous:  " + ambiguous.length + (ambiguous.length ? "  (need a park to disambiguate)" : ""));
  console.log("Unmatched:  " + unmatched.length + (unmatched.length ? "  (not found in master list / spelling)" : ""));
  if (dupes.length) console.log("Duplicate rows skipped: " + dupes.length);
  console.log("Ride counts: " + (anyCount ? "yes (unlocks ride-count stats)" : "no"));
  console.log("First dates: " + (anyFirst ? "yes (adds First Ridden column; timeline if all credits dated)" : "no"));
  console.log("Wrote " + credits.length + " credits -> " + outPath);
  if (ambiguous.length) { console.log("\n-- Ambiguous (pick a park) --"); ambiguous.forEach(x => console.log("  " + x)); }
  if (unmatched.length) { console.log("\n-- Unmatched (fix spelling or add to master) --"); unmatched.forEach(x => console.log("  " + x)); }
  console.log("");
}

main();
