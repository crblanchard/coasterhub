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
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', name, NULL, json_object('id', id, 'from', 'Mountain Glider (left)', 'park', park) FROM coasters WHERE name = 'Mountain Glider (Left)' AND park = 'Ripley''s Mountain Coaster' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_renamed' AND subject = 'Mountain Glider (Left)');

-- Lightning Rod (-2020) (#1045) merged into Lightning Rod (#611), Dollywood
-- (Carter, same day: "Remove lightning rod (-2020) and make sure everyone's
-- rides and rankings move to the new one (especially keltan's)"). The same
-- steps as POST /api/merge, run by hand through the D1 connector on
-- 2026-10-17 — the first change a session wrote to D1 itself, at Carter's
-- say-so. Before: 6 rides on #1045. Keltan (bugmonster1) and Nolan had only
-- #1045 and keep the credit; Keltan's #11 moved over. aidenalsodoescoasters,
-- aidendoescoasters, bladeefan and kuiperskorner had both, undated, so each
-- lost the duplicate ride row (rides 5722, 6068, 7189, 7385) and one credit.
-- Nobody had ranked both.
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT 611, 'Lightning Rod (-2020)', 'merge', date('now') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1045 AND name = 'Lightning Rod (-2020)');
UPDATE rides SET coaster_id = 611 WHERE coaster_id = 1045;
DELETE FROM rides WHERE coaster_id = 611 AND d IS NULL AND id NOT IN (SELECT MIN(id) FROM rides WHERE coaster_id = 611 AND d IS NULL GROUP BY user_slug);
UPDATE OR IGNORE rankings SET coaster_id = 611 WHERE coaster_id = 1045;
DELETE FROM rankings WHERE coaster_id = 1045;
DELETE FROM coasters WHERE id = 1045 AND name = 'Lightning Rod (-2020)';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Lightning Rod', NULL, json_object('from', 1045, 'to', 611, 'fromName', 'Lightning Rod (-2020)', 'park', 'Dollywood') WHERE NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_merged' AND detail LIKE '%"fromName":"Lightning Rod (-2020)"%');
