-- 132: Lakeside Amusement Park (Denver) against its RCDB page, Carter 2026-11-05.
--   - "Coaster" (steel, thrill, opened 2023-09-01) was missing. RCDB's park
--     table gives no maker or model; left NULL until Carter sends its page.
--   - Cyclone (1940) and Dragon (1986) are SBNO on RCDB, not removed. They came
--     in with the original import as closed 2022 / 2019. SBNO spells are not
--     recorded (see 048, 125), so both go back to operating: closed cleared.
--   - The six defunct 1908-1937 woodies RCDB lists are left out on purpose
--     (Carter: "all the defunct ones we don't need because they're so old").
-- Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Coaster', 'Lakeside Amusement Park', 'Steel', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2023, '2023-09-01', 'day', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Coaster' AND park = 'Lakeside Amusement Park');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Coaster' AND c.park = 'Lakeside Amusement Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 1, json_object('id', id, 'fields', json_array('closed'), 'via', '132') FROM coasters WHERE park = 'Lakeside Amusement Park' AND name IN ('Cyclone', 'Dragon') AND closed IS NOT NULL;
UPDATE coasters SET closed = NULL, closedPrec = NULL WHERE park = 'Lakeside Amusement Park' AND name IN ('Cyclone', 'Dragon') AND closed IS NOT NULL;
-- Then Carter sent Coaster's own page: Pinfari Zyklon (Z64), built 1973, and a
-- relocation — it is the Zyklon that ran at Celebration City (2000-2001). Its
-- other homes (Hamel's Park, Saginaw County Fairgrounds, Fun Plex) are not in
-- the database. Lakeside's row is the home (where it runs now).
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 2, json_object('id', id, 'fields', json_array('manu', 'model'), 'via', '132') FROM coasters WHERE name = 'Coaster' AND park = 'Lakeside Amusement Park' AND manu IS NULL;
UPDATE coasters SET manu = 'Pinfari', model = 'Pinfari Zyklon' WHERE name = 'Coaster' AND park = 'Lakeside Amusement Park' AND manu IS NULL;
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Coaster' AND h.park = 'Lakeside Amusement Park' AND (c.id = h.id OR (c.name = 'Zyklon' AND c.park = 'Celebration City'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '132') FROM coasters h WHERE h.name = 'Coaster' AND h.park = 'Lakeside Amusement Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
