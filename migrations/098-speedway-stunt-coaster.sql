-- 098: Speedway Stunt Coaster, Six Flags Mexico (Vekoma Family Boomerang 208m
-- Rebound, opened 31 Jan 2026), from Carter's RCDB screenshot, 2026-10-31. RCDB
-- gives only 0 inversions. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Speedway Stunt Coaster', 'Six Flags Mexico', 'Steel', 'Vekoma', 'Vekoma Family Boomerang', NULL, NULL, NULL, 0, NULL, 2026, '2026-01-31', 'day', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Speedway Stunt Coaster' AND park = 'Six Flags Mexico');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Speedway Stunt Coaster' AND c.park = 'Six Flags Mexico' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- Stats from a second screenshot Carter sent the same evening (a sister Family
-- Boomerang Rebound's figures, which he asked to use): 75.5 ft, 37.3 mph,
-- 672.6 ft, 1:36. Guarded on no length.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 4, json_object('id', id, 'fields', json_array('h', 's', 'l', 'dur'), 'via', '098') FROM coasters WHERE name = 'Speedway Stunt Coaster' AND park = 'Six Flags Mexico' AND l IS NULL;
UPDATE coasters SET h = 75.5, s = 37.3, l = 672.6, dur = 96 WHERE name = 'Speedway Stunt Coaster' AND park = 'Six Flags Mexico' AND l IS NULL;
