-- 079: Erlebnispark Tripsdrill's stats, from RCDB via Carter's screenshots,
-- 2026-10-29. All five rows had no numbers (most also no maker).
--   G'sengte Sau: Gerstlauer Bobsled, 52.5 ft, 1,574.8 ft, since 1998.
--   Hals-über-Kopf: Vekoma Suspended Thrill Coaster (a new model name on the
--     site, maker-first like the rest), 98.4 ft, 49.7 mph, 2,395 ft, 3 inv,
--     since 26 Jun 2020.
--   Karacho: Gerstlauer Infinity, 98.4 ft, 55.9 mph, 2,296.6 ft, 4 inv,
--     since 10 Jul 2013.
--   Mammut: wood by Cordes Holzbau (no model), 98.4 ft, 52.8 mph,
--     2,821.5 ft, since 28 Apr 2008.
--   Rasender Tausendfüßler: Zierer Tivoli (large), 26.3 ft, 22.4 mph,
--     1,181.1 ft, since 1986 — so it joins the Zierer Tivolis category.
-- Each: the Worker's coaster_edited activity row, then the update, guarded
-- on the row still having no length, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '079') FROM coasters WHERE name = 'G''sengte Sau' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
UPDATE coasters SET manu = 'Gerstlauer', model = 'Gerstlauer Bobsled', h = 52.5, l = 1574.8, inv = 0, yr = 1998, opened = '1998', openedPrec = 'year' WHERE name = 'G''sengte Sau' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '079') FROM coasters WHERE name = 'Hals-über-Kopf' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Suspended Thrill Coaster', h = 98.4, s = 49.7, l = 2395, inv = 3, yr = 2020, opened = '2020-06-26', openedPrec = 'day' WHERE name = 'Hals-über-Kopf' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '079') FROM coasters WHERE name = 'Karacho' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
UPDATE coasters SET manu = 'Gerstlauer', model = 'Gerstlauer Infinity', h = 98.4, s = 55.9, l = 2296.6, inv = 4, yr = 2013, opened = '2013-07-10', openedPrec = 'day' WHERE name = 'Karacho' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '079') FROM coasters WHERE name = 'Mammut' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
UPDATE coasters SET manu = 'Cordes Holzbau', h = 98.4, s = 52.8, l = 2821.5, inv = 0, yr = 2008, opened = '2008-04-28', openedPrec = 'day' WHERE name = 'Mammut' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '079') FROM coasters WHERE name = 'Rasender Tausendfüßler' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
UPDATE coasters SET manu = 'Zierer', model = 'Zierer Tivoli', h = 26.3, s = 22.4, l = 1181.1, inv = 0, yr = 1986, opened = '1986', openedPrec = 'year' WHERE name = 'Rasender Tausendfüßler' AND park = 'Erlebnispark Tripsdrill' AND l IS NULL;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Rasender Tausendfüßler' AND c.park = 'Erlebnispark Tripsdrill' AND g.name = 'Zierer Tivolis';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 0, 'via', '079') FROM clone_groups g WHERE g.name = 'Zierer Tivolis' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"079"%');
