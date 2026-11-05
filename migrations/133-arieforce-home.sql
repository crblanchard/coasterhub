-- 133: ArieForce One shows as "Unknown – Six Flags Magic Mountain" on Global
-- rankings (Carter, 2026-11-05: "just weird"). 099 linked it to its unbuilt 2028
-- Magic Mountain row and made THAT row the set's home, and a relocated ride is
-- listed under its home's name — a placeholder here. Until the new one has a
-- name and opens, the home is ArieForce One at Fun Spot Atlanta, where it runs.
-- When the Magic Mountain name is announced: rename it through /edit and move
-- the home back (UPDATE same_ride SET ride = <its id> WHERE ride = <ArieForce's>).
-- Safe to run twice.
UPDATE same_ride SET ride = (SELECT id FROM coasters WHERE name = 'ArieForce One' AND park = 'Fun Spot America - Atlanta') WHERE ride = (SELECT id FROM coasters WHERE name = 'Unknown' AND park = 'Six Flags Magic Mountain');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '133') FROM coasters h WHERE h.name = 'ArieForce One' AND h.park = 'Fun Spot America - Atlanta' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"133"%');
