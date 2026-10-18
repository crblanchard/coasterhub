-- 070: Oaks Amusement Park (Portland, OR), from RCDB via Carter's
-- screenshots and pin, 2026-10-18.
--   Adrenaline Peak (since 24 Mar 2018): Gerstlauer Euro-Fighter, 72 ft,
--     45 mph, 1,050 ft, 3 inversions.
--   Zoooooom Coaster (since 1999): E&F Miler family coaster (model name as
--     for the Kings Island/Dominion Great Pumpkins), 16 ft, 416 ft. Earlier
--     names Zoom Coaster and Zoooooom kept as aliases.
--   Looping Thunder (1996 - 24 Sep 2017): Pinfari Zyklon (ZL42), 36.1 ft,
--     1,197.5 ft, 1 inversion.
--   Monster Mouse (1977-94): Allan Herschell Wild Mouse, no stats. RCDB says
--     it came from "Playland", without saying which; not linked.
-- Guarded on name + park, so a second run is a no-op.

INSERT INTO parks (name, lat, lon, region) SELECT 'Oaks Amusement Park', 45.472620607478085, -122.66162183305023, 'Oregon, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Oaks Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Adrenaline Peak', 'Oaks Amusement Park', 'Steel', 'Gerstlauer', 'Gerstlauer Euro-Fighter', 72, 45, 1050, 3, NULL, 1, 2018, '2018-03-24', 'day', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Oaks Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Adrenaline Peak' AND park = 'Oaks Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Zoooooom Coaster', 'Oaks Amusement Park', 'Steel', 'E&F Miler', 'Miler Kiddie', 16, NULL, 416, 0, NULL, 1, 1999, '1999', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Oaks Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Zoooooom Coaster' AND park = 'Oaks Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Looping Thunder', 'Oaks Amusement Park', 'Steel', 'Pinfari', 'Pinfari Zyklon', 36.1, NULL, 1197.5, 1, NULL, 1, 1996, '1996', 'year', '2017-09-24', 'day' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Oaks Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Looping Thunder' AND park = 'Oaks Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Monster Mouse', 'Oaks Amusement Park', 'Steel', 'Allan Herschell', 'Allan Herschell Wild Mouse', NULL, NULL, NULL, 0, NULL, 1, 1977, '1977', 'year', '1994', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Oaks Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Monster Mouse' AND park = 'Oaks Amusement Park');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Zoom Coaster', 'rcdb', date('now') FROM coasters WHERE name = 'Zoooooom Coaster' AND park = 'Oaks Amusement Park';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Zoooooom', 'rcdb', date('now') FROM coasters WHERE name = 'Zoooooom Coaster' AND park = 'Oaks Amusement Park';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Oaks Amusement Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = c.park);
