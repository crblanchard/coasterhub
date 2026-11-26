-- Cannonball! at Holiday World (Carter, 2026-11-26): the $22M MACK Rides water
-- coaster announced July 1, 2026 for the Fourth of July land, opening 2027
-- (May 2027 in most reports; the park: "America's fastest water coaster").
-- 90 ft tall, 45 mph (75 ft drop). Model "MACK Water Coaster", as the site's
-- other fifteen. Not a category model, so no 216 re-run. Idempotent.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Cannonball!', 'Holiday World', 'Steel', 'MACK Rides', 'MACK Water Coaster', 90, 45, NULL, 0, NULL, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Cannonball!' AND park = 'Holiday World');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Cannonball!' AND c.park = 'Holiday World' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
