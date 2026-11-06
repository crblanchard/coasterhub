-- 165: the rest of Playcenter São Paulo, and Parque de la Costa (Tigre,
-- Argentina; coordinates from LatLong.net), from Carter's RCDB screenshots,
-- 2026-11-06.
-- Playcenter (all removed): Looping Star (Schwarzkopf, 9/1996 to 2012-07-29;
--   also Liseberg's Lisebergs Loopen, Ita Park and Tivoli Park, rows/parks we
--   don't have), Super Jet (Pinfari Zyklon Z64, 1973-1996; later Parque
--   Mutirama, not here), Tornado (Schwarzkopf Jet Star 2, 1982-2001; later Beto
--   Carrero World, not here; into Schwarzkopf Jet Stars), Windstorm (S&MC
--   Hurricane, 2005-08-06 to 2012-02-26) = Playland Park's Hurricane, linked;
--   its last stop, Alpen Park (as Fogo do Dragão), is not here, so Windstorm,
--   the later row we have, is the home.
-- Parque de la Costa (operating unless noted): Boomerang (1998, into Vekoma
--   Boomerangs), Desafío (Vekoma SLC 689m, 1999, into Vekoma SLCs), Torbellino
--   (Beijing Jiuhua spinner, 2010-07-04), Vigía (Zierer Tivoli Large, 1998,
--   into Zierer Tivolis), and Tronador (Interpark loop coaster, removed:
--   1997-05-05 to 1997).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Parque de la Costa', -34.416626, -58.577087, 'Argentina', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de la Costa');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Looping Star','Playcenter São Paulo','Steel','Schwarzkopf','Looping Star',80.4,47.8,1942.3,1,NULL,1996,'1996-09','month','2012-07-29','day',1),
 ('Super Jet','Playcenter São Paulo','Steel','Pinfari','Pinfari Zyklon',NULL,NULL,NULL,0,NULL,1973,'1973','year','1996-06-01','year',1),
 ('Tornado','Playcenter São Paulo','Steel','Schwarzkopf','Schwarzkopf Jet Star',44.3,NULL,1919.3,0,NULL,1982,'1982','year','2001-06-01','year',1),
 ('Windstorm','Playcenter São Paulo','Steel','S&MC','Hurricane',NULL,NULL,1300.0,0,NULL,2005,'2005-08-06','day','2012-02-26','day',1),
 ('Boomerang','Parque de la Costa','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1998,'1998','year',NULL,NULL,1),
 ('Desafío','Parque de la Costa','Steel','Vekoma','Vekoma Suspended Looping Coaster',109.3,49.7,2260.5,5,96,1999,'1999','year',NULL,NULL,1),
 ('Torbellino','Parque de la Costa','Steel','Beijing Jiuhua',NULL,NULL,NULL,1115.5,0,NULL,2010,'2010-07-04','day',NULL,NULL,1),
 ('Vigía','Parque de la Costa','Steel','Zierer','Zierer Tivoli',26.3,22.4,1181.1,0,NULL,1998,'1998','year',NULL,NULL,1),
 ('Tronador','Parque de la Costa','Steel','Interpark',NULL,NULL,NULL,NULL,1,NULL,1997,'1997-05-05','day','1997-09-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Playcenter São Paulo', 'Parque de la Costa') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Playcenter São Paulo', 'Parque de la Costa') AND ((c.model = 'Vekoma Boomerang' AND g.name = 'Vekoma Boomerangs') OR (c.model = 'Vekoma Suspended Looping Coaster' AND g.name = 'Vekoma SLCs') OR (c.model = 'Zierer Tivoli' AND g.name = 'Zierer Tivolis') OR (c.model = 'Schwarzkopf Jet Star' AND g.name = 'Schwarzkopf Jet Stars')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Windstorm' AND h.park = 'Playcenter São Paulo' AND (c.id = h.id OR (c.name = 'Hurricane' AND c.park = 'Playland Park'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '165') FROM coasters h WHERE h.name = 'Windstorm' AND h.park = 'Playcenter São Paulo' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
