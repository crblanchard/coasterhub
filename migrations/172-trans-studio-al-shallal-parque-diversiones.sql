-- 172: Trans Studio Bali, Trans Studio Cibubur, Al-Shallal Theme Park and Parque
-- Diversiones, from Carter's RCDB screenshots, 2026-11-06 (Boomerang sweep, page 2).
-- Coordinates ESTIMATED (listed in missing-parks.md). All still operating.
--   Trans Studio Bali: Boomerang Challenge Coaster (= Pleasure Island's Boomerang)
--     and Bat Glider (Caripro Batflyer, ex Plopsaland's Vleermuis, no row yet).
--   Trans Studio Cibubur: Boomerang Hyper Coaster (= Knott's Boomerang), Alien Taxi
--     (Maurer SC 2000 = 'Maurer Spinner', ex Drievliet / Dixie Landin' Xtreme, no
--     rows yet) and Bat Glider (ex Hamanako Pal Pal, no row yet).
--   Al-Shallal: Boomerang-Roller Coaster (ex 'Krachen') and a Zamperla Twister
--     Coaster 420m wild mouse (2019).
--   Parque Diversiones: Bocaraca (MK-1200 = Playland Park's Whirlwind = Knoebels'
--     Whirlwind, no row yet), Búmeran (= Playcenter's Boomerang), plus Montana
--     Ghibli, Teletren, Torbellino (Zamperla wild mouse), and two removed rides:
--     Ciclon (Pinfari Zyklon, 1987-11 to 2009 [RCDB says 2006-2009]) and Huracán
--     (Pax Magic Steed, 1993-10-30 to 2003 [RCDB says '<= 2003']).
-- Each home is the row running now. Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Trans Studio Bali', -8.6770, 115.2000, 'Indonesia', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Trans Studio Bali');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Trans Studio Cibubur', -6.3660, 106.9000, 'Indonesia', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Trans Studio Cibubur');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Al-Shallal Theme Park', 21.5100, 39.1400, 'Saudi Arabia', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Al-Shallal Theme Park');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Parque Diversiones', 9.9547, -84.1198, 'Costa Rica', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Parque Diversiones');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Bat Glider','Trans Studio Bali','Steel','Caripro','Caripro Batflyer',NULL,NULL,NULL,0,NULL,2019,'2019-12-12','day',NULL,NULL,1),
 ('Boomerang Challenge Coaster','Trans Studio Bali','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2019,'2019-12-12','day',NULL,NULL,1),
 ('Alien Taxi','Trans Studio Cibubur','Steel','Maurer Rides','Maurer Spinner',50.8,37.3,1391.1,0,86,2019,'2019-07','month',NULL,NULL,1),
 ('Bat Glider','Trans Studio Cibubur','Steel','Caripro','Caripro Batflyer',45.9,NULL,912.1,0,NULL,2019,'2019-07','month',NULL,NULL,1),
 ('Boomerang Hyper Coaster','Trans Studio Cibubur','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2021,'2021-05-14','day',NULL,NULL,1),
 ('Boomerang-Roller Coaster','Al-Shallal Theme Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2004,'2004','year',NULL,NULL,1),
 ('Wild Mouse','Al-Shallal Theme Park','Steel','Zamperla','Zamperla Twister',NULL,NULL,NULL,0,NULL,2019,'2019','year',NULL,NULL,1),
 ('Bocaraca','Parque Diversiones','Steel','Vekoma','Vekoma MK-1200',64.0,37.3,1148.3,2,NULL,2005,'2005-11-27','day',NULL,NULL,1),
 ('Búmeran','Parque Diversiones','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2012,'2012-11-25','day',NULL,NULL,1),
 ('Montana Ghibli','Parque Diversiones','Steel','Lucrezia di Cartoceto','Powered Coaster',11.1,NULL,NULL,0,NULL,1984,'1984-05','month',NULL,NULL,1),
 ('Teletren','Parque Diversiones','Steel','Zamperla','Zamperla Family Gravity Coaster',13.0,NULL,262.5,0,NULL,2002,'2002-12','month',NULL,NULL,1),
 ('Torbellino','Parque Diversiones','Steel','Zamperla','Zamperla Twister',NULL,NULL,NULL,0,NULL,2018,'2018-12-25','day',NULL,NULL,1),
 ('Ciclon','Parque Diversiones','Steel','Pinfari','Pinfari Zyklon',36.8,NULL,1099.1,0,NULL,1987,'1987-11','month','2009','year',1),
 ('Huracán','Parque Diversiones','Steel','Pax Company','Pax Magic Steed',39.3,NULL,1017.1,1,NULL,1993,'1993-10-30','day','2003','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Trans Studio Bali','Trans Studio Cibubur','Al-Shallal Theme Park','Parque Diversiones') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Trans Studio Bali','Trans Studio Cibubur','Al-Shallal Theme Park','Parque Diversiones') AND c.name IN ('Boomerang Challenge Coaster','Boomerang Hyper Coaster','Boomerang-Roller Coaster','Búmeran') AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Krachen', 'rcdb', date('now') FROM coasters WHERE park = 'Al-Shallal Theme Park' AND name = 'Boomerang-Roller Coaster';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Boomerang Challenge Coaster' AND h.park = 'Trans Studio Bali' AND ((c.id = h.id) OR (c.name = 'Boomerang' AND c.park = 'Pleasure Island Family Theme Park'))) OR
 (h.name = 'Boomerang Hyper Coaster' AND h.park = 'Trans Studio Cibubur' AND ((c.id = h.id) OR (c.name = 'Boomerang' AND c.park = 'Knott''s Berry Farm'))) OR
 (h.name = 'Búmeran' AND h.park = 'Parque Diversiones' AND ((c.id = h.id) OR (c.name = 'Boomerang' AND c.park = 'Playcenter São Paulo'))) OR
 (h.name = 'Bocaraca' AND h.park = 'Parque Diversiones' AND ((c.id = h.id) OR (c.name = 'Whirlwind' AND c.park = 'Playland Park')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '172') FROM coasters h WHERE ((h.name = 'Boomerang Challenge Coaster' AND h.park = 'Trans Studio Bali') OR (h.name = 'Boomerang Hyper Coaster' AND h.park = 'Trans Studio Cibubur') OR (h.name IN ('Búmeran','Bocaraca') AND h.park = 'Parque Diversiones')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"172"%' AND json_extract(a.detail, '$.ride') = h.id);
