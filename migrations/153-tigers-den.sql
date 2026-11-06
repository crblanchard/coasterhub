-- 153: Tigers Den, Adventureland (New York) — announced 2026-11-06, opening
-- 2027 (Carter: "New coaster dropped"). Zamperla family coaster 92m (Rev B),
-- single centre helix, 15 ft, 16 mph, 301 ft. Stored with its 2027 year, like
-- Massai and the Magic Mountain RMC. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Tigers Den', 'Adventureland (New York)', 'Steel', 'Zamperla', 'Zamperla Family Coaster', 15.0, 16.0, 301.0, 0, NULL, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Tigers Den' AND park = 'Adventureland (New York)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Tigers Den' AND c.park = 'Adventureland (New York)' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
