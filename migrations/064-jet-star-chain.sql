-- 064: the Beech Bend Jet Star's real story, from RCDB via Carter's
-- screenshots of all five of its pages, 2026-10-17.
--
-- RCDB: one Schwarzkopf Jet Star (44.3 ft, 31.1 mph, 1,765.1 ft) went
--   Beech Bend (1968/72-1984) -> Noble Park Funland (1985-86) ->
--   Kentucky Kingdom as Starchaser (1987-95) -> Six Flags Darien Lake as
--   Nightmare At Phantom Cave (1996-98) -> Great Escape as Nightmare at Crack
--   Axle Canyon (1999-2006).
-- The site had linked Beech Bend's Jet Star (#1312) to Tig'rr at Indiana Beach
-- (#632), on the relocation rule's say-so (same model, Tig'rr opened the year
-- the Jet Star closed — identical stats, the Boomerang trap again). It was
-- never confirmed and RCDB says otherwise, so that link goes
-- (same_ride_removed, the Worker's shape) and Tig'rr stands alone.
--
-- Then the two Nightmares are added and the four rows the site has (Beech
-- Bend, Starchaser #1802, both Nightmares) become one ride, home the last
-- one, Nightmare at Crack Axle Canyon. Noble Park Funland is not on the site
-- (it needs a pin first); its stint can join the set later.
-- Every statement is guarded, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_removed', c.name, NULL, json_object('id', c.id, 'park', c.park, 'from', json_object('name', h.name, 'park', h.park)) FROM coasters c, coasters h WHERE c.id = 1312 AND h.id = 632 AND EXISTS (SELECT 1 FROM same_ride WHERE coaster = 1312 AND ride = 632);
DELETE FROM same_ride WHERE ride = 632 AND coaster IN (1312, 632);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Nightmare At Phantom Cave', 'Six Flags Darien Lake', 'Steel', 'Schwarzkopf', 'Schwarzkopf Jet Star', 44.3, 31.1, 1765.1, 0, NULL, 1, 1996, '1996', 'year', '1998', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Six Flags Darien Lake') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Nightmare At Phantom Cave' AND park = 'Six Flags Darien Lake');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Nightmare at Crack Axle Canyon', 'Six Flags Great Escape', 'Steel', 'Schwarzkopf', 'Schwarzkopf Jet Star', 44.3, 31.1, 1765.1, 0, NULL, 1, 1999, '1999', 'year', '2006', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Six Flags Great Escape') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Nightmare at Crack Axle Canyon' AND park = 'Six Flags Great Escape');
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, h.id FROM coasters h, coasters x WHERE h.name = 'Nightmare at Crack Axle Canyon' AND h.park = 'Six Flags Great Escape' AND (x.id IN (1312, 1802) OR x.id = h.id OR (x.name = 'Nightmare At Phantom Cave' AND x.park = 'Six Flags Darien Lake'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Nightmare At Phantom Cave' AND c.park = 'Six Flags Darien Lake' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Six Flags Darien Lake');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Nightmare at Crack Axle Canyon' AND c.park = 'Six Flags Great Escape' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Six Flags Great Escape');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '064') FROM coasters h WHERE h.name = 'Nightmare at Crack Axle Canyon' AND h.park = 'Six Flags Great Escape' AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) = 4 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"064"%');
