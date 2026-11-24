-- 228: cleanup (Carter, 2026-11-24: "1 yes please. 2 ... put in manually it
-- closed 2025. 3 delete it. 4 fill them ... 5 yes please. 6 yes please ...
-- 8 keep them if there is any information ... 11 yes please").
-- 1. The year follows the opening date where they disagree (29 rows).
UPDATE coasters SET yr = CAST(substr(opened, 1, 4) AS INTEGER) WHERE opened IS NOT NULL AND yr IS NOT NULL AND CAST(substr(opened, 1, 4) AS INTEGER) <> yr;
-- 2. Bullet (Selva Mágica) closed in 2025 (Carter), not 1982. Milky Way
--    (Greenland) "closed 1990-09-20" a year before it opened; its source says
--    operating, so the stray date goes.
UPDATE coasters SET closed = '2025', closedPrec = 'year' WHERE name = 'Bullet' AND park = 'Selva Mágica' AND closed = '1982-09-25';
UPDATE coasters SET closed = NULL, closedPrec = NULL WHERE name = 'Milky Way' AND park = 'Greenland' AND closed = '1990-09-20';
-- 3. Skyscraper (SkyPlex) was never built. No riders.
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', l.source, l.ref, 0, 'reject', 'never built / no information (228)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links l JOIN coasters c ON c.id = l.coaster_id WHERE (c.name = 'Skyscraper' AND c.park = 'SkyPlex') OR (c.name = 'Baby Wildcat' AND c.park = 'Idora Park' AND c.manu IS NULL AND c.opened IS NULL);
DELETE FROM open_facts WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Skyscraper' AND park = 'SkyPlex');
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Skyscraper' AND park = 'SkyPlex');
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Skyscraper' AND park = 'SkyPlex');
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (SELECT id FROM coasters WHERE name = 'Skyscraper' AND park = 'SkyPlex');
DELETE FROM coasters WHERE name = 'Skyscraper' AND park = 'SkyPlex' AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL) AND id NOT IN (SELECT coaster_id FROM rankings);
DELETE FROM parks WHERE name = 'SkyPlex' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'SkyPlex');
-- 4. Steel for the typeless rides that are built: Vekoma, Intamin, Jung-Max,
--    and the Wiegand/Edsun/ski-resort bob and mountain coasters (steel track;
--    the source's "Other"). The unbuilt Epic Universe "Unknown" and Aero Test
--    Lab stay blank.
UPDATE coasters SET type = 'Steel' WHERE type IS NULL AND ((name = 'Diabolik' AND park = 'Movieland Park') OR (name = 'Lightning Bolt' AND park = 'MGM Grand Adventures Theme Park') OR (name = 'Dragon' AND park = 'Parken Zoo') OR (name = 'Tobotronc' AND park = 'Naturlandia') OR (name = 'Mountain Coaster' AND park = 'Cranmore Mountain Adventure Park') OR (name = 'Babibob' AND park = 'Parc de Procé') OR (name = 'Rodelbanan' AND park = 'Fun City (Halland)') OR (name = 'Tobogán' AND park = 'Chapelco Ski Resort'));
-- 5. Regions: one spelling for Czechia, and the three parks with none.
UPDATE parks SET region = 'Czechia' WHERE region = 'Czech Republic';
UPDATE parks SET region = 'Texas, US' WHERE name = 'Boardwalk Fun Park' AND (region IS NULL OR region = '');
UPDATE parks SET region = 'Nevada, US' WHERE name = 'MGM Grand Adventures Theme Park' AND (region IS NULL OR region = '');
UPDATE parks SET region = 'Poland' WHERE name = 'PowerLand' AND (region IS NULL OR region = '');
-- 6. "unknown" -> "Unknown", like the rest.
UPDATE coasters SET name = 'Unknown' WHERE name = 'unknown';
-- 8. The one pre-2000 closure with nothing else known (no maker, model,
--    stats or opening): Baby Wildcat, Idora Park, closed 1984. No riders.
DELETE FROM open_facts WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Baby Wildcat' AND park = 'Idora Park' AND manu IS NULL AND model IS NULL AND h IS NULL AND l IS NULL AND opened IS NULL);
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Baby Wildcat' AND park = 'Idora Park' AND manu IS NULL AND model IS NULL AND h IS NULL AND l IS NULL AND opened IS NULL);
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Baby Wildcat' AND park = 'Idora Park' AND manu IS NULL AND model IS NULL AND h IS NULL AND l IS NULL AND opened IS NULL);
DELETE FROM coasters WHERE name = 'Baby Wildcat' AND park = 'Idora Park' AND manu IS NULL AND model IS NULL AND h IS NULL AND l IS NULL AND opened IS NULL AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL) AND id NOT IN (SELECT coaster_id FROM rankings);
-- 11. Pins: of the 33 parks with none, 32 are travelling showmen (no fixed
--    place). Southport Pleasureland (now Adventure Coast Southport) from its
--    Wikipedia infobox.
UPDATE parks SET lat = 53.64918, lon = -3.01707 WHERE name = 'Southport Pleasureland' AND lat IS NULL;
