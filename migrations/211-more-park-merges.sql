-- Three more one-park-two-names merges (Carter, 2026-11-20: "merge old
-- orchard beach. delphins merge to the first name. st louis merge and keep the
-- new location/name").
--   Old Orchard Beach -> Palace Playland (the park in that town).
--   Delphin Be Grand Resort -> Delphin Aqua Serenity. Both "Apple Worm Train"
--     rows were linked to the same Coasterpedia page: one ride, so the second
--     row (2830) goes and the one at Aqua Serenity (2829) stays.
--   St. Louis's Incredible Pizza Company -> St. Louis' Incredible Pizza
--     Company, keeping the new park's name and pin. Its "Spinning Coaster"
--     (679, 3 riders) and the new "Incredible Spin Coaster" (4102) are one SBF
--     Visa spinner (closed 2024): the riders' row stays, takes the new name,
--     the Coasterpedia link and its opening date; "Spinning Coaster" becomes a
--     former name; 4102 goes. No rider's credits change.
-- Guarded; a second run does nothing.

-- the extra rows
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) VALUES ('match', 'coasterpedia', 'Incredible Spin Coaster', 679, 'approve', 'merged with 4102 (211)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
DELETE FROM open_facts WHERE coaster_id IN (2830, 4102);
DELETE FROM open_links WHERE coaster_id IN (2830, 4102);
DELETE FROM coaster_sources WHERE coaster_id IN (2830, 4102);
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (2830, 4102);
DELETE FROM coasters WHERE (id = 2830 AND park = 'Delphin Be Grand Resort') OR (id = 4102 AND park = 'St. Louis'' Incredible Pizza Company');
-- 679 becomes the one Incredible Spin Coaster
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Incredible Spin Coaster', NULL, json_object('id', 679, 'from', 'Spinning Coaster', 'park', 'St. Louis'' Incredible Pizza Company') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 679 AND name = 'Spinning Coaster');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT 679, 'Spinning Coaster', 'merged', date('now') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 679 AND name = 'Spinning Coaster');
UPDATE coasters SET name = 'Incredible Spin Coaster', manu = COALESCE(manu, 'SBF Visa'), opened = COALESCE(opened, '2016-11-04'), openedPrec = COALESCE(openedPrec, 'day'), yr = COALESCE(yr, 2016) WHERE id = 679 AND name = 'Spinning Coaster';
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) VALUES (679, 'coasterpedia', 'Incredible Spin Coaster', 'approved', date('now'));
INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT 679, field, value, prec, source, ref, cites_rcdb, date('now') FROM open_record_facts WHERE source = 'coasterpedia' AND ref = 'Incredible Spin Coaster';
-- the parks
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_merged', m.b, (SELECT COUNT(*) FROM coasters c WHERE c.park = m.a), json_object('from', m.a) FROM m WHERE EXISTS (SELECT 1 FROM parks p WHERE p.name = m.a);
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) UPDATE activity SET detail = json_set(detail, '$.park', (SELECT b FROM m WHERE m.a = json_extract(activity.detail, '$.park'))) WHERE kind IN ('coaster_added', 'coaster_renamed') AND json_extract(detail, '$.park') IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) UPDATE coasters SET park = (SELECT b FROM m WHERE m.a = coasters.park) WHERE park IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) UPDATE park_aliases SET park = (SELECT b FROM m WHERE m.a = park_aliases.park) WHERE park IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) SELECT b, a, 'merged', date('now') FROM m WHERE EXISTS (SELECT 1 FROM parks p WHERE p.name = m.a);
WITH m(a, b) AS (VALUES ('Old Orchard Beach', 'Palace Playland'), ('Delphin Be Grand Resort', 'Delphin Aqua Serenity'), ('St. Louis''s Incredible Pizza Company', 'St. Louis'' Incredible Pizza Company')) DELETE FROM parks WHERE name IN (SELECT a FROM m) AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
