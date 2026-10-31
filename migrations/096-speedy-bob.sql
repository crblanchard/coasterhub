-- 096: Speedy Bob is two mirror-image MACK Wilde Maus Compacts at Bobbejaanland
-- (Carter, 2026-10-31, with both RCDB pages). The site had one row (496), and
-- 095 linked it to Vertigo - but 496's five rides are all from 2025, so 496 is
-- the RIGHT mouse, still operating (1:45). The LEFT mouse ran 2 Jul 1998 to
-- 2008 (1:25) and is the one that went to Madrid as Vertigo.
--   1. take 496 out of Vertigo's set (095's link), and drop the set if only
--      Vertigo is left in it;
--   2. 496 -> "Speedy Bob (Right)", duration 105 (as Stampida/Grand National
--      name their tracks);
--   3. add "Speedy Bob (Left)", closed 2008, and link it to Vertigo.
-- Safe to run twice.
DELETE FROM same_ride WHERE coaster = (SELECT id FROM coasters WHERE name IN ('Speedy Bob','Speedy Bob (Right)') AND park = 'Bobbejaanland' AND (closed IS NULL)) AND ride = (SELECT id FROM coasters WHERE name = 'Vértigo' AND park = 'Parque de Atracciones de Madrid');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Speedy Bob (Right)', NULL, json_object('id', id, 'from', 'Speedy Bob', 'park', park) FROM coasters WHERE name = 'Speedy Bob' AND park = 'Bobbejaanland';
UPDATE coasters SET name = 'Speedy Bob (Right)', dur = 105 WHERE name = 'Speedy Bob' AND park = 'Bobbejaanland';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Speedy Bob (Left)', 'Bobbejaanland', 'Steel', 'MACK Rides', 'MACK Wild Mouse', 45.9, 28.0, 1213.9, 0, 85, 1998, '1998-07-02', 'day', '2008', 'year', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Speedy Bob (Left)' AND park = 'Bobbejaanland');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Speedy Bob (Left)' AND c.park = 'Bobbejaanland' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Vértigo' AND h.park = 'Parque de Atracciones de Madrid' AND (c.id = h.id OR (c.name = 'Speedy Bob (Left)' AND c.park = 'Bobbejaanland'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '096') FROM coasters h WHERE h.name = 'Vértigo' AND h.park = 'Parque de Atracciones de Madrid' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"096"%');
