-- 080: Volldampf (Tripsdrill) and Gardaland, from RCDB via Carter's
-- screenshots, 2026-10-29.
--   Volldampf: Vekoma Family Boomerang (custom), 72.2 ft, 37.3 mph, 780.8 ft,
--     since 26 Jun 2020. It was already modelled; it joins Vekoma Family
--     Boomerangs.
--   Blue Tornado: Vekoma SLC (765m standard w/ helix), 109.3 ft, 49.7 mph,
--     2,509.8 ft, 5 inv, 1:42, since 1998 -> Vekoma SLCs.
--   Mammut (Gardaland): Vekoma Mine Train (custom), 45.9 ft, 31.1 mph,
--     3,264.4 ft, 2:45, since 19 Mar 2008.
--   Oblivion the Black Hole: B&M Dive, 139.4 ft, 62.1 mph, 1,856.9 ft, 2 inv,
--     since 28 Mar 2015. RCDB writes it "Oblivion - The Black Hole"; the
--     site's name stays.
--   Dragon Rush: Fabbri Spinner (Power Mouse), 45.9 ft, 24.9 mph, since
--     14 May 2016 — called Kung Fu Panda Master until 2024. The site had it
--     TWICE: #710 Kung Fu Panda Master (maxg and flx-ksl logged it) and a bare
--     #1739 Dragon Rush (nobody's, per the 10-25 snapshot). As with Kentucky
--     Kingdom (061) the old row is kept and renamed, the stub's rides (if any
--     have appeared since) move onto it, and the stub goes.
-- Each stat update is guarded on the row still having no height, so a second
-- run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 7, json_object('id', id, 'fields', json_array('h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '080') FROM coasters WHERE name = 'Volldampf' AND park = 'Erlebnispark Tripsdrill' AND h IS NULL;
UPDATE coasters SET h = 72.2, s = 37.3, l = 780.8, inv = 0, yr = 2020, opened = '2020-06-26', openedPrec = 'day' WHERE name = 'Volldampf' AND park = 'Erlebnispark Tripsdrill' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '080') FROM coasters WHERE name = 'Blue Tornado' AND park = 'Gardaland' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Suspended Looping Coaster', h = 109.3, s = 49.7, l = 2509.8, inv = 5, dur = 102, yr = 1998, opened = '1998', openedPrec = 'year' WHERE name = 'Blue Tornado' AND park = 'Gardaland' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '080') FROM coasters WHERE name = 'Mammut' AND park = 'Gardaland' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Mine Train', h = 45.9, s = 31.1, l = 3264.4, inv = 0, dur = 165, yr = 2008, opened = '2008-03-19', openedPrec = 'day' WHERE name = 'Mammut' AND park = 'Gardaland' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '080') FROM coasters WHERE name = 'Oblivion the Black Hole' AND park = 'Gardaland' AND h IS NULL;
UPDATE coasters SET manu = 'Bolliger & Mabillard', model = 'B&M Dive', h = 139.4, s = 62.1, l = 1856.9, inv = 2, yr = 2015, opened = '2015-03-28', openedPrec = 'day' WHERE name = 'Oblivion the Black Hole' AND park = 'Gardaland' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '080') FROM coasters WHERE name = 'Kung Fu Panda Master' AND park = 'Gardaland' AND h IS NULL;
UPDATE coasters SET manu = 'Fabbri', model = 'Fabbri Spinner', h = 45.9, s = 24.9, inv = 0, yr = 2016, opened = '2016-05-14', openedPrec = 'day' WHERE name = 'Kung Fu Panda Master' AND park = 'Gardaland' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Dragon Rush', NULL, json_object('from', 1739, 'to', 710, 'fromName', 'Dragon Rush', 'park', 'Gardaland') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1739 AND name = 'Dragon Rush' AND park = 'Gardaland');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Dragon Rush', NULL, json_object('id', 710, 'from', 'Kung Fu Panda Master', 'park', 'Gardaland') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 710 AND name = 'Kung Fu Panda Master');
UPDATE rides SET coaster_id = 710 WHERE coaster_id = 1739 AND EXISTS (SELECT 1 FROM coasters WHERE id = 710 AND park = 'Gardaland');
DELETE FROM rides WHERE coaster_id = 710 AND d IS NULL AND id NOT IN (SELECT MIN(id) FROM rides WHERE coaster_id = 710 AND d IS NULL GROUP BY user_slug);
UPDATE OR IGNORE rankings SET coaster_id = 710 WHERE coaster_id = 1739;
DELETE FROM rankings WHERE coaster_id = 1739;
UPDATE OR IGNORE credits SET coaster_id = 710 WHERE coaster_id = 1739;
DELETE FROM credits WHERE coaster_id = 1739;
UPDATE OR IGNORE clone_members SET coaster = 710 WHERE coaster = 1739;
DELETE FROM clone_members WHERE coaster = 1739;
UPDATE OR IGNORE rider_category_members SET coaster = 710 WHERE coaster = 1739;
DELETE FROM rider_category_members WHERE coaster = 1739;
UPDATE OR IGNORE same_ride SET coaster = 710 WHERE coaster = 1739;
DELETE FROM same_ride WHERE coaster = 1739;
DELETE FROM coasters WHERE id = 1739 AND name = 'Dragon Rush' AND park = 'Gardaland' AND NOT EXISTS (SELECT 1 FROM rides WHERE coaster_id = 1739);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Kung Fu Panda Master', 'rename', '2024' FROM coasters WHERE id = 710 AND name = 'Kung Fu Panda Master';
UPDATE coasters SET name = 'Dragon Rush' WHERE id = 710 AND name = 'Kung Fu Panda Master' AND park = 'Gardaland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Volldampf' AND c.park = 'Erlebnispark Tripsdrill' AND g.name = 'Vekoma Family Boomerangs';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Blue Tornado' AND c.park = 'Gardaland' AND g.name = 'Vekoma SLCs';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 0, 'via', '080') FROM clone_groups g WHERE g.name IN ('Vekoma Family Boomerangs', 'Vekoma SLCs') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"080"%');
