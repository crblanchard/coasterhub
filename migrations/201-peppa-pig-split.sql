-- Peppa Pig Theme Park is two parks: Winter Haven, Florida (2022) and North
-- Richland Hills, Texas (2025). The site had only Texas, and its Daddy Pig's
-- Roller Coaster (2963) was linked to the Florida ride's Coasterpedia page by
-- the weekly name+park matcher (its stats were already Texas's). Found
-- 2026-11-19 checking the Happy Valley mix-up (200); the matchers now skip a
-- record 30+ km away or at another town of a chain.
-- Texas becomes "Peppa Pig Theme Park (North Richland Hills)", Florida goes in
-- as "Peppa Pig Theme Park (Winter Haven)" (pin from its coaster's page); its
-- coaster is added through the Worker afterwards
-- (tools/open-data/split-201.json). Guarded; a second run does nothing.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Peppa Pig Theme Park (North Richland Hills)', 1, json_object('from', 'Peppa Pig Theme Park') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Peppa Pig Theme Park') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Peppa Pig Theme Park (North Richland Hills)');
UPDATE parks SET name = 'Peppa Pig Theme Park (North Richland Hills)' WHERE name = 'Peppa Pig Theme Park';
UPDATE coasters SET park = 'Peppa Pig Theme Park (North Richland Hills)' WHERE park = 'Peppa Pig Theme Park';
UPDATE park_aliases SET park = 'Peppa Pig Theme Park (North Richland Hills)' WHERE park = 'Peppa Pig Theme Park';
UPDATE activity SET detail = json_set(detail, '$.park', 'Peppa Pig Theme Park (North Richland Hills)') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Peppa Pig Theme Park';
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Peppa Pig Theme Park (Winter Haven)', 27.98686, -81.68887, 'Florida, US', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Peppa Pig Theme Park (Winter Haven)');

-- 2963's link and facts: the Texas page.
DELETE FROM open_facts WHERE coaster_id = 2963 AND source = 'coasterpedia' AND ref = 'Daddy Pig''s Roller Coaster (Florida)';
UPDATE open_links SET ref = 'Daddy Pig''s Roller Coaster (Texas)', method = 'approved' WHERE coaster_id = 2963 AND source = 'coasterpedia' AND ref = 'Daddy Pig''s Roller Coaster (Florida)';
INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT 2963, field, value, prec, source, ref, cites_rcdb, date('now') FROM open_record_facts WHERE source = 'coasterpedia' AND ref = 'Daddy Pig''s Roller Coaster (Texas)';
