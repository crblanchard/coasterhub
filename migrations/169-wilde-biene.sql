-- 169: Safariland Stukenbrock's Wilde Biene (Zierer Tivoli Large, 1979;
-- "Marienkäferbahn" to 2023), from Carter's RCDB screenshot, 2026-11-06.
-- Not added: Safariland's Alpen Coaster (Schwaben Park's Himalayabahn), which
-- was set up in 2017 but never opened there, so it never ran at this park.
-- Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Wilde Biene', 'Safariland Stukenbrock', 'Steel', 'Zierer', 'Zierer Tivoli', 26.3, 22.4, 1181.1, 0, NULL, 1979, '1979', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wilde Biene' AND park = 'Safariland Stukenbrock');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Wilde Biene' AND c.park = 'Safariland Stukenbrock' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Marienkäferbahn', 'rcdb', date('now') FROM coasters WHERE name = 'Wilde Biene' AND park = 'Safariland Stukenbrock';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Wilde Biene' AND c.park = 'Safariland Stukenbrock' AND g.name = 'Zierer Tivolis' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
