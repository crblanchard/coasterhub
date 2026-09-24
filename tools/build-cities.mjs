#!/usr/bin/env node
/* Builds map-cities.json, the city names /map draws under its park discs.
 *
 *   npm i --no-save all-the-cities && node tools/build-cities.mjs
 *
 * The source is GeoNames (CC BY 4.0, credited in the map's attribution) by
 * way of the all-the-cities npm package. Kept: real towns and capitals
 * (feature codes PPL, PPLA*, PPLC — not PPLX, which is a neighbourhood) of at
 * least 100,000 people, biggest first, because /map walks the list in order
 * and stops at the first one below the zoom's threshold. Each entry is
 * [name, lat, lon, population in thousands], fetched only by /map.
 *
 * A place within 15 km of a bigger one already kept is dropped: GeoNames
 * lists Brooklyn, Queens and Scarborough as places of their own, and a map
 * that names Brooklyn beside New York reads as a mistake.
 *
 * The map's own tile labels were tried first and taken off (2026-09-21) —
 * they are baked into the tiles, so they sat under the discs. Drawing the
 * names ourselves is what lets a label step aside for a disc.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cities = createRequire(import.meta.url)("all-the-cities");
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[2] - a[2]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const out = [];
cities
  .filter(c => /^PPL(A\d?|C)?$/.test(c.featureCode) && c.population >= 100000)
  .sort((a, b) => b.population - a.population)
  .forEach(c => {
    const e = [c.name, +c.loc.coordinates[1].toFixed(3), +c.loc.coordinates[0].toFixed(3),
               Math.round(c.population / 1000)];
    if (!out.some(k => Math.abs(k[1] - e[1]) < 0.3 && km(k, e) < 15)) out.push(e);
  });
writeFileSync(join(ROOT, "map-cities.json"), JSON.stringify(out));
console.log("map-cities.json <- " + out.length + " cities");
