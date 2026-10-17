-- 037: racing pairs with a missing half (Carter, 2026-10-17: "duplicate both
-- racing pairs and fix (left)").
--   Nagashima Spaland had only "Wild Mouse (Right)" (id 536). "Wild Mouse (Left)"
--     is added with the same specs: the two tracks are the same ride.
--   Ripley's Mountain Coaster had "Mountain Glider (left)" (1099). It becomes
--     "(Left)", the casing of the 8 other Left/Right pairs, and gets a
--     "Mountain Glider (Right)". The park's other ride, "Ripley's Mountain
--     Coaster" (1100), is left alone.
-- A new half is a new coaster: nobody's credits or rankings change. The
-- /changes rows are the ones the Worker writes for the same edits.
-- Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Wild Mouse (Left)', park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec FROM coasters WHERE name = 'Wild Mouse (Right)' AND park = 'Nagashima Spaland' AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wild Mouse (Left)' AND park = 'Nagashima Spaland');
UPDATE coasters SET name = 'Mountain Glider (Left)' WHERE name = 'Mountain Glider (left)' AND park = 'Ripley''s Mountain Coaster';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mountain Glider (Right)', park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec FROM coasters WHERE name = 'Mountain Glider (Left)' AND park = 'Ripley''s Mountain Coaster' AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mountain Glider (Right)' AND park = 'Ripley''s Mountain Coaster');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', name, NULL, json_object('id', id, 'park', park) FROM coasters WHERE name = 'Wild Mouse (Left)' AND park = 'Nagashima Spaland' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_added' AND subject = 'Wild Mouse (Left)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', name, NULL, json_object('id', id, 'park', park) FROM coasters WHERE name = 'Mountain Glider (Right)' AND park = 'Ripley''s Mountain Coaster' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_added' AND subject = 'Mountain Glider (Right)');
