-- 048: relocations at Alabama Adventure, from the RCDB pages Carter sent
-- (2026-10-17; "dont need all the sbno info" — SBNO spells are not recorded).
-- All five Alabama Adventure coasters were already in D1 with their stats.
--   UNDO: Zoomerang (#1299) was linked to Boomerang at Six Flags St. Louis
--     (#256) by 045's rule, because every Vekoma Boomerang is 116.5 ft and
--     935 ft. RCDB: Zoomerang went to Wonderla Hyderabad as Recoil (not in
--     D1). Nobody rode Zoomerang, so no count moved either way. The triage
--     now warns when a model has several rides with identical numbers.
--   LINK: Marvel Mania (#1298, Alabama, 1998-2011) -> Blazin' Buckaroo
--     (#743, Elitch Gardens, 2013-), RCDB's relocation. Nobody rode Marvel
--     Mania. /changes rows in the Worker's shapes. Safe to run twice.
DELETE FROM same_ride WHERE coaster IN (1299, 256) AND ride = 256;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_removed', 'Zoomerang', NULL, json_object('id', 1299, 'park', 'Alabama Adventure', 'from', json_object('name', 'Boomerang', 'park', 'Six Flags St. Louis'), 'via', '048') WHERE NOT EXISTS (SELECT 1 FROM same_ride WHERE coaster = 1299) AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'same_ride_removed' AND detail LIKE '%"via":"048"%');
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, 743 FROM coasters x WHERE (x.id = 1298 AND x.name = 'Marvel Mania' AND x.park = 'Alabama Adventure') OR (x.id = 743 AND x.name = 'Blazin'' Buckaroo' AND x.park = 'Elitch Gardens');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '048') FROM coasters h WHERE h.id = 743 AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = 743) = 2 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"048"%');
