-- 220: Barrels O' Fun at Six Flags Great Adventure comes back (Carter,
-- 2026-11-23: "I removed barrels o fun from great adventure ... can I bring it
-- back"). It was never deleted: both of its source suggestions (Coasterpedia,
-- English Wikipedia) were rejected in /sources/review on 2026-11-19 and -20, so
-- it was never added. Stats from those two sources, which agree: Zamperla
-- Twister Coaster 420 (stored as `Zamperla Spinner`, like the others), 42.7 ft,
-- 29.1 mph, 1,377.9 ft, 1:30, opened 2026-07-08 in Green Lantern's old spot.
-- It is Ragin' Cajun from Six Flags America (2004-2025, id 186) moved, so the
-- two are linked as one ride, with the new row as home (it is the one running).
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps)
SELECT (SELECT MAX(id) FROM coasters) + 1, 'Barrels O'' Fun', 'Six Flags Great Adventure', 'Steel', 'Zamperla', 'Zamperla Spinner',
  42.7, 29.1, 1377.9, 0, 90, 2026, '2026-07-08', 'day', NULL, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Barrels O'' Fun' AND park = 'Six Flags Great Adventure');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Barrels O'' Fun' AND c.park = 'Six Flags Great Adventure' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR REPLACE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters h, coasters c WHERE h.name = 'Barrels O'' Fun' AND h.park = 'Six Flags Great Adventure' AND ((c.id = h.id) OR (c.name = 'Ragin'' Cajun' AND c.park = 'Six Flags America'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '220') FROM coasters h WHERE h.name = 'Barrels O'' Fun' AND h.park = 'Six Flags Great Adventure' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"220"%');
-- The two rejections become matches, so the weekly refresh neither offers it
-- again nor treats the sources as strangers.
UPDATE open_reviews SET kind = 'match', decision = 'approve', coaster_id = (SELECT id FROM coasters WHERE name = 'Barrels O'' Fun' AND park = 'Six Flags Great Adventure'), note = 'restored (220)' WHERE kind = 'add' AND decision = 'reject' AND ref IN ('Barrels O'' Fun (Six Flags Great Adventure)', 'Barrels O'' Fun');
