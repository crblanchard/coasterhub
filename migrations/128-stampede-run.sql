-- 128: Kentucky Kingdom's Lightning Run is now Stampede Run (Carter, 2026-11-05:
-- "was just renamed"). The old name goes into coaster_aliases so links and
-- searches by it still land; the coaster_renamed row is logged BEFORE the
-- UPDATE (it matches on the old name), so a second run does nothing.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Stampede Run', NULL, json_object('id', id, 'from', 'Lightning Run', 'park', park) FROM coasters WHERE name = 'Lightning Run' AND park = 'Kentucky Kingdom';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Lightning Run', 'renamed 2026', date('now') FROM coasters WHERE name = 'Lightning Run' AND park = 'Kentucky Kingdom';
UPDATE coasters SET name = 'Stampede Run' WHERE name = 'Lightning Run' AND park = 'Kentucky Kingdom' AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Stampede Run' AND park = 'Kentucky Kingdom');
