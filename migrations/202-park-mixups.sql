-- Every other park mixed up like Happy Valley (Carter, 2026-11-19: "find
-- wherever else parks are inaccurate like that"). Two checks over all linked
-- coasters: (1) a coaster's source coordinates 15+ km from its park's pin,
-- (2) one park's coasters whose Coasterpedia locations name different towns.
-- Spelling variants ("Baden Wuerttemberg") and pages whose coordinates sit at
-- the park anyway (Colourful Yunnan's Wing Coaster, Land of Legends' Typhoon,
-- Niagara's Max's Doggy Dog) were left alone.
--
-- Pins that were simply wrong (the coasters' own coordinates; Scandia's coaster
-- is the Sacramento one, Craig's Cruisers' the Mears one):
--   Le Pal, Kernie's Familienpark, Celebration City, Prairie Playland, Scandia,
--   Craig's Cruisers.
-- Chains split, each park named with its town (Carter's convention, 198/200):
--   Coco Park (Saint-Avold / Douar Alaoui), Dream Park (6th of October City /
--   Amman), Eden Park (Pompei / Rome), Fantasy Island (Ingoldmells / Canvey
--   Island), Fantawild Land (Taizhou / Xiaogan), Happy World (Fuzhou / Nanjing),
--   MagicLand (Valmontone / Krasnoyarsk), VinWonders (Hội An / Nha Trang /
--   Phú Quốc). New parks' pins are ESTIMATES at the town except Fantawild
--   Dreamland (Zhuzhou), from its coaster (missing-parks.md lists them).
-- Moved: Stress Express 2842 to Fantawild Adventure (Zhengzhou); Jungle
--   Trailblazer 3094 to Fantawild Dreamland (Zhuzhou), the park next door;
--   Star Force Orbiter 3165 to Tom Foolery's Round Rock.
-- Wikidata links to another copy of the ride removed and rejected: Shanghai's
--   Seven Dwarfs Mine Train (Magic Kingdom's item), Kings Dominion's Backlot
--   Stunt Coaster, Paris's Avengers Assemble: Flight Force. No live value came
--   from them.
-- Every correct Coasterpedia link here (and 199/201's) is recorded as an
-- approved match, so the weekly matcher keeps it. Nobody has ridden a moved
-- coaster. Guarded; a second run does nothing.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Coco Park (Saint-Avold)', (SELECT COUNT(*) FROM coasters WHERE park = 'Coco Park'), json_object('from', 'Coco Park') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Coco Park') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Coco Park (Saint-Avold)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Dream Park (6th of October City)', (SELECT COUNT(*) FROM coasters WHERE park = 'Dream Park'), json_object('from', 'Dream Park') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Dream Park') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Dream Park (6th of October City)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Eden Park (Pompei)', (SELECT COUNT(*) FROM coasters WHERE park = 'Eden Park'), json_object('from', 'Eden Park') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Eden Park') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Eden Park (Pompei)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Fantasy Island (Ingoldmells)', (SELECT COUNT(*) FROM coasters WHERE park = 'Fantasy Island'), json_object('from', 'Fantasy Island') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fantasy Island') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fantasy Island (Ingoldmells)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Fantawild Land (Taizhou)', (SELECT COUNT(*) FROM coasters WHERE park = 'Fantawild Land'), json_object('from', 'Fantawild Land') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fantawild Land') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fantawild Land (Taizhou)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Happy World (Fuzhou)', (SELECT COUNT(*) FROM coasters WHERE park = 'Happy World'), json_object('from', 'Happy World') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Happy World') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Happy World (Fuzhou)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'MagicLand (Valmontone)', (SELECT COUNT(*) FROM coasters WHERE park = 'MagicLand'), json_object('from', 'MagicLand') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'MagicLand') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'MagicLand (Valmontone)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'VinWonders (Hội An)', (SELECT COUNT(*) FROM coasters WHERE park = 'VinWonders'), json_object('from', 'VinWonders') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'VinWonders') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'VinWonders (Hội An)');
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES ('Coco Park (Douar Alaoui)', 34.0181, -5.0078, 'Morocco'), ('Dream Park (Amman)', 31.9539, 35.9106, 'Jordan'), ('Eden Park (Rome)', 41.9028, 12.4964, 'Italy'), ('Fantasy Island (Canvey Island)', 51.5236, 0.5886, 'United Kingdom'), ('Fantawild Dreamland (Zhuzhou)', 27.98499, 113.18715, 'China'), ('Fantawild Land (Xiaogan)', 30.9246, 113.9169, 'China'), ('Happy World (Nanjing)', 32.0603, 118.6286, 'China'), ('MagicLand (Krasnoyarsk)', 56.0153, 92.8932, 'Russia'), ('VinWonders (Nha Trang)', 12.2219, 109.242, 'Vietnam'), ('VinWonders (Phú Quốc)', 10.336, 103.856, 'Vietnam')) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
UPDATE coasters SET park = 'Coco Park (Douar Alaoui)' WHERE id = 2617 AND park = 'Coco Park';
UPDATE coasters SET park = 'Dream Park (Amman)' WHERE id = 2366 AND park = 'Dream Park';
UPDATE coasters SET park = 'Eden Park (Rome)' WHERE id = 2629 AND park = 'Eden Park';
UPDATE coasters SET park = 'Fantasy Island (Canvey Island)' WHERE id = 1366 AND park = 'Fantasy Island';
UPDATE coasters SET park = 'Fantawild Adventure (Zhengzhou)' WHERE id = 2842 AND park = 'Fantawild Adventure (Zhuzhou)';
UPDATE coasters SET park = 'Fantawild Dreamland (Zhuzhou)' WHERE id = 3094 AND park = 'Fantawild Adventure (Zhuzhou)';
UPDATE coasters SET park = 'Fantawild Land (Xiaogan)' WHERE id = 2483 AND park = 'Fantawild Land';
UPDATE coasters SET park = 'Happy World (Nanjing)' WHERE id = 2650 AND park = 'Happy World';
UPDATE coasters SET park = 'MagicLand (Krasnoyarsk)' WHERE id = 2242 AND park = 'MagicLand';
UPDATE coasters SET park = 'Tom Foolerys Adventure Park (Round Rock)' WHERE id = 3165 AND park = 'Tom Foolerys Adventure Park (Wisconsin Dells)';
UPDATE coasters SET park = 'VinWonders (Nha Trang)' WHERE id = 2343 AND park = 'VinWonders';
UPDATE coasters SET park = 'VinWonders (Phú Quốc)' WHERE id = 2340 AND park = 'VinWonders';
UPDATE coasters SET park = 'VinWonders (Phú Quốc)' WHERE id = 2341 AND park = 'VinWonders';
UPDATE coasters SET park = 'VinWonders (Phú Quốc)' WHERE id = 2342 AND park = 'VinWonders';
UPDATE parks SET name = 'Coco Park (Saint-Avold)' WHERE name = 'Coco Park';
UPDATE coasters SET park = 'Coco Park (Saint-Avold)' WHERE park = 'Coco Park';
UPDATE park_aliases SET park = 'Coco Park (Saint-Avold)' WHERE park = 'Coco Park';
UPDATE parks SET name = 'Dream Park (6th of October City)' WHERE name = 'Dream Park';
UPDATE coasters SET park = 'Dream Park (6th of October City)' WHERE park = 'Dream Park';
UPDATE park_aliases SET park = 'Dream Park (6th of October City)' WHERE park = 'Dream Park';
UPDATE parks SET name = 'Eden Park (Pompei)' WHERE name = 'Eden Park';
UPDATE coasters SET park = 'Eden Park (Pompei)' WHERE park = 'Eden Park';
UPDATE park_aliases SET park = 'Eden Park (Pompei)' WHERE park = 'Eden Park';
UPDATE parks SET name = 'Fantasy Island (Ingoldmells)' WHERE name = 'Fantasy Island';
UPDATE coasters SET park = 'Fantasy Island (Ingoldmells)' WHERE park = 'Fantasy Island';
UPDATE park_aliases SET park = 'Fantasy Island (Ingoldmells)' WHERE park = 'Fantasy Island';
UPDATE parks SET name = 'Fantawild Land (Taizhou)' WHERE name = 'Fantawild Land';
UPDATE coasters SET park = 'Fantawild Land (Taizhou)' WHERE park = 'Fantawild Land';
UPDATE park_aliases SET park = 'Fantawild Land (Taizhou)' WHERE park = 'Fantawild Land';
UPDATE parks SET name = 'Happy World (Fuzhou)' WHERE name = 'Happy World';
UPDATE coasters SET park = 'Happy World (Fuzhou)' WHERE park = 'Happy World';
UPDATE park_aliases SET park = 'Happy World (Fuzhou)' WHERE park = 'Happy World';
UPDATE parks SET name = 'MagicLand (Valmontone)' WHERE name = 'MagicLand';
UPDATE coasters SET park = 'MagicLand (Valmontone)' WHERE park = 'MagicLand';
UPDATE park_aliases SET park = 'MagicLand (Valmontone)' WHERE park = 'MagicLand';
UPDATE parks SET name = 'VinWonders (Hội An)' WHERE name = 'VinWonders';
UPDATE coasters SET park = 'VinWonders (Hội An)' WHERE park = 'VinWonders';
UPDATE park_aliases SET park = 'VinWonders (Hội An)' WHERE park = 'VinWonders';
UPDATE parks SET lat = 46.50905, lon = 3.62881 WHERE name = 'Le Pal';
UPDATE parks SET lat = 51.7621, lon = 6.32862 WHERE name = 'Kernie''s Familienpark';
UPDATE parks SET lat = 36.65042, lon = -93.29417 WHERE name = 'Celebration City';
UPDATE parks SET lat = 32.69586, lon = -97.05092 WHERE name = 'Prairie Playland';
UPDATE parks SET lat = 38.66013, lon = -121.36385 WHERE name = 'Scandia Family Fun Center';
UPDATE parks SET lat = 43.66748, lon = -86.48722 WHERE name = 'Craig''s Cruisers';
UPDATE activity SET detail = json_set(detail, '$.park', (SELECT c.park FROM coasters c WHERE c.id = json_extract(activity.detail, '$.id'))) WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (2617,2366,2629,1366,2842,3094,2483,2650,2242,3165,2343,2340,2341,2342) OR (kind = 'coaster_added' AND json_extract(detail, '$.park') IN ('Coco Park','Dream Park','Eden Park','Fantasy Island','Fantawild Land','Happy World','MagicLand','VinWonders'));
DELETE FROM open_facts WHERE coaster_id = 2485 AND source = 'coasterpedia' AND ref = 'Puppy Coaster (Fantawild Land Hubei)';
DELETE FROM open_links WHERE coaster_id = 2485 AND source = 'coasterpedia';
INSERT INTO open_links (coaster_id, source, ref, method, added) VALUES (2485, 'coasterpedia', 'Puppy Coaster (Fantawild Land Taizhou)', 'approved', date('now'));
INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT 2485, field, value, prec, source, ref, cites_rcdb, date('now') FROM open_record_facts WHERE source = 'coasterpedia' AND ref = 'Puppy Coaster (Fantawild Land Taizhou)';
DELETE FROM open_facts WHERE source = 'wikidata' AND ((coaster_id = 836 AND ref = 'Q2182970') OR (coaster_id = 200 AND ref = 'Q798461') OR (coaster_id = 1223 AND ref = 'Q1502476'));
DELETE FROM open_links WHERE source = 'wikidata' AND ((coaster_id = 836 AND ref = 'Q2182970') OR (coaster_id = 200 AND ref = 'Q798461') OR (coaster_id = 1223 AND ref = 'Q1502476'));
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) VALUES ('match', 'wikidata', 'Q2182970', 836, 'reject', 'another copy (202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'wikidata', 'Q798461', 200, 'reject', 'another copy (202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'wikidata', 'Q1502476', 1223, 'reject', 'another copy (202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'coasterpedia', 'Puppy Coaster (Fantawild Land Hubei)', 2485, 'reject', 'another park (202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'match', 'coasterpedia', ref, coaster_id, 'approve', 'park fix (202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links WHERE source = 'coasterpedia' AND coaster_id IN (2617,2366,2629,1366,2842,3094,2483,2650,2242,3165,2343,2340,2341,2342);
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) VALUES ('match', 'coasterpedia', 'Jungle Trailblazer (Oriental Heritage Xiamen)', 2322, 'approve', 'park fix (199-202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'coasterpedia', 'Stress Express (Oriental Heritage Zhejiang)', 2323, 'approve', 'park fix (199-202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'coasterpedia', 'Puppy Coaster (Fantawild Land Taizhou)', 2485, 'approve', 'park fix (199-202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'coasterpedia', 'Butterfly (Erlebnispark Schloss Thurn; opened 2022)', 2633, 'approve', 'park fix (199-202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')), ('match', 'coasterpedia', 'Daddy Pig''s Roller Coaster (Texas)', 2963, 'approve', 'park fix (199-202)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
