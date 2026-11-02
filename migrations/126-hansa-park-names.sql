-- 126: Hansa-Park name fixes, Carter 2026-11-02.
--   Kleiner Zar -> Kleine Zar (a typo in our row).
--   Die Schlange von Midgard -> Schlange von Midgard (drop the article).
--   Nessie keeps its name; it was "Nessie Superrollercoaster" from opening to
--   2018, recorded as a former name so search finds it (Carter typed "Nessir",
--   read as the obvious typo).
-- The old spellings go into coaster_aliases too, so links and searches by them
-- still land. Each rename logs its coaster_renamed row BEFORE the UPDATE (it
-- matches on the old name), so a second run finds nothing to log or change.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Kleine Zar', NULL, json_object('id', id, 'from', 'Kleiner Zar', 'park', park) FROM coasters WHERE name = 'Kleiner Zar' AND park = 'Hansa-Park';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Kleiner Zar', 'typo', date('now') FROM coasters WHERE name = 'Kleiner Zar' AND park = 'Hansa-Park';
UPDATE coasters SET name = 'Kleine Zar' WHERE name = 'Kleiner Zar' AND park = 'Hansa-Park' AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Kleine Zar' AND park = 'Hansa-Park');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Schlange von Midgard', NULL, json_object('id', id, 'from', 'Die Schlange von Midgard', 'park', park) FROM coasters WHERE name = 'Die Schlange von Midgard' AND park = 'Hansa-Park';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Die Schlange von Midgard', 'carter', date('now') FROM coasters WHERE name = 'Die Schlange von Midgard' AND park = 'Hansa-Park';
UPDATE coasters SET name = 'Schlange von Midgard' WHERE name = 'Die Schlange von Midgard' AND park = 'Hansa-Park' AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Schlange von Midgard' AND park = 'Hansa-Park');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Nessie Superrollercoaster', 'opening to 2018', date('now') FROM coasters WHERE name = 'Nessie' AND park = 'Hansa-Park';
