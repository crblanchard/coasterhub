-- 182: J3 Grand Prix, Lagoon's Intamin Hot Racer opening 2027 (Carter's RCDB
-- screenshot, 2026-11-18). 1,746 ft, 50 ft, 40 mph, 3 inversions, 1:42.
-- Model "Hot Racer" (RCDB: Hot Racer / Custom); no Intamin string for it
-- existed yet. Shows as Under construction. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'J3 Grand Prix', 'Lagoon', 'Steel', 'Intamin', 'Hot Racer', 50.0, 40.0, 1746.0, 3, 102, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'J3 Grand Prix' AND park = 'Lagoon');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Lagoon' AND c.name = 'J3 Grand Prix' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
