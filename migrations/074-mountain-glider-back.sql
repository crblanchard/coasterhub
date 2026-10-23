-- 074: undo 038 — Mountain Glider is back.
--
-- Carter, 2026-10-23: "Add mountain glider back". 038 deleted both halves
-- (Left #1099, Keltan's 2019-11-17 log; Right #1765, nobody's). They come
-- back as they were before 038: same names, same park (Ripley's Mountain
-- Coaster, where Keltan's list filed it — 038 noted it is really at Rowdy Bear
-- Mountain, Gatlinburg, which the site does not have), no stats, and
-- Keltan's ride on (Left) with its date. New ids; nothing else referenced
-- the old ones. Guarded on name + park and on Keltan's row, so a second run
-- is a no-op.

INSERT INTO coasters (id, name, park, type, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mountain Glider (Left)', 'Ripley''s Mountain Coaster', 'Steel', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mountain Glider (Left)' AND park = 'Ripley''s Mountain Coaster');
INSERT INTO coasters (id, name, park, type, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mountain Glider (Right)', 'Ripley''s Mountain Coaster', 'Steel', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mountain Glider (Right)' AND park = 'Ripley''s Mountain Coaster');
INSERT INTO rides (user_slug, coaster_id, d) SELECT 'bugmonster1', c.id, '2019-11-17' FROM coasters c WHERE c.name = 'Mountain Glider (Left)' AND c.park = 'Ripley''s Mountain Coaster' AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.user_slug = 'bugmonster1' AND r.coaster_id = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Ripley''s Mountain Coaster' AND c.name LIKE 'Mountain Glider (%' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
