-- STATUS: run on D1 2026-11-26 at Carter's go-ahead ("merge please").
-- Draak at Plopsaland Belgium is Draconis, renamed: the MACK powered coaster
-- (2004) was called Draak / De Draak before (Coasterpedia's "Draak" redirects
-- to Draconis; plopsa.com's own page is Draconis). The site had both: Draconis
-- with its stats and riders, Draak empty (no stats, no rides) but holding the
-- Wikidata link and its 20 Commons photos. Carter asked for Draak's stats,
-- 2026-11-26. Merge Draak into Draconis: the names become former names, the
-- link moves, the empty row goes, and /changes gets a coaster_merged row.
-- Matched by name + park; a second run finds no Draak and does nothing.
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.n, 'rcdb', date('now') FROM coasters c, (SELECT 'Draak' AS n UNION ALL SELECT 'De Draak') v WHERE c.name = 'Draconis' AND c.park = 'Plopsaland Belgium' AND EXISTS (SELECT 1 FROM coasters d WHERE d.name = 'Draak' AND d.park = 'Plopsaland Belgium') AND NOT EXISTS (SELECT 1 FROM coaster_aliases a WHERE a.coaster_id = c.id AND a.former_name = v.n);
UPDATE OR IGNORE open_links SET coaster_id = (SELECT id FROM coasters WHERE name = 'Draconis' AND park = 'Plopsaland Belgium') WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Draak' AND park = 'Plopsaland Belgium');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Draconis', NULL, json_object('from', d.id, 'to', c.id, 'fromName', 'Draak', 'park', 'Plopsaland Belgium') FROM coasters d, coasters c WHERE d.name = 'Draak' AND d.park = 'Plopsaland Belgium' AND c.name = 'Draconis' AND c.park = 'Plopsaland Belgium' AND d.id NOT IN (SELECT coaster_id FROM rides);
DELETE FROM open_links WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Draak' AND park = 'Plopsaland Belgium');
DELETE FROM coaster_sources WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Draak' AND park = 'Plopsaland Belgium');
DELETE FROM coaster_aliases WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Draak' AND park = 'Plopsaland Belgium');
DELETE FROM coasters WHERE name = 'Draak' AND park = 'Plopsaland Belgium' AND id NOT IN (SELECT coaster_id FROM rides);
