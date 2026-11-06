-- 159: Miner's Mountain Express, Silver Dollar City, opening 2027 (Carter's
-- RCDB screenshot, 2026-11-06). MACK family coaster, 3,553 ft, 0 inversions,
-- 3:18, two lifts (97 ft and 69.5 ft; the taller is stored as its height).
-- No model yet, per Carter ("don't put a model on this one yet"). Plain
-- apostrophe in the name rather than RCDB's curly one. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Miner''s Mountain Express', 'Silver Dollar City', 'Steel', 'MACK Rides', NULL, 97.0, NULL, 3553.0, 0, 198, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Miner''s Mountain Express' AND park = 'Silver Dollar City');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Miner''s Mountain Express' AND c.park = 'Silver Dollar City' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
