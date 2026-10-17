-- 042: Idlewild & SoakZone, Ligonier, Pennsylvania (Carter, 2026-10-17, from
-- RCDB; 40.2614940353373, -79.27701454510112). Not in D1 before.
--   Rollo Coaster  PTC wooden, 1938, 900 ft, 27 ft, 0 inv
--   Wild Mouse     Vekoma Wild Mouse, 1,640.4 ft, 56 ft, 0 inv. RCDB dates it
--                  5/15/1993, the ride's first opening; it came here after
--                  Wiener Prater (Speeedy Gonzales) and Alton Towers (Alton
--                  Mouse, which IS in D1). Relocations are not linked yet
--                  (Carter: "figure out relocations later").
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region) SELECT 'Idlewild & SoakZone', 40.2614940353373, -79.27701454510112, 'Pennsylvania, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Idlewild & SoakZone');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Rollo Coaster', 'Idlewild & SoakZone', 'Wood', 'Philadelphia Toboggan Coasters', 'PTC Wood', 27, NULL, 900, 0, NULL, 1, 1938, '1938', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Idlewild & SoakZone') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Rollo Coaster' AND park = 'Idlewild & SoakZone');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Wild Mouse', 'Idlewild & SoakZone', 'Steel', 'Vekoma', 'Vekoma Wild Mouse', 56, NULL, 1640.4, 0, NULL, 1, 1993, '1993-05-15', 'day', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Idlewild & SoakZone') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wild Mouse' AND park = 'Idlewild & SoakZone');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Idlewild & SoakZone' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Idlewild & SoakZone');
