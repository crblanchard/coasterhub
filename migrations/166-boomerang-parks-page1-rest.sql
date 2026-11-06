-- 166: the rest of page 1 of Carter's Boomerang park list, from his RCDB
-- screenshots, 2026-11-06. SBNO spells stored as operating, as usual.
-- Jerudong Park Playground (Brunei; Wikipedia coordinates): Junior Coaster
--   (Preston & Barbieri 33x20, 2014), and three removed 2005/06 (stored 2006)
--   that all went to Siam Amazing Park (not here): Boomerang (1996), Pony
--   Express (Zamperla custom powered, 1995, 1,797.9 ft), Pusing Lagi (Vekoma SLC
--   787m extended, 1997; into Vekoma SLCs).
-- Gero Land (Obour, Egypt; pin from Coasterpedia's Boomerang location):
--   Boomerang (1997), Junior Coaster (Vekoma 335m, 1997), Dragon (Zamperla
--   twin helix, "<= 2002", no date).
-- E-World (Daegu, South Korea; pin an ESTIMATE by 83 Tower): Camel Back
--   (Meisho, 3/1995), Hurricane (3 inv, 3/1995), Magic Castle (EOS dark-ride
--   coaster, 3/1995), Boomerang (3/1995).
-- Zygo Park (Nice, France, 1987-1991; pin an ESTIMATE): Boomerang = Walygator
--   Sud-Ouest's Boomerang, linked; Tarzungle (Zierer Tivoli Medium) = Walibi
--   Holland's Drako, linked. The running rows are the homes.
-- Boomerangs into Vekoma Boomerangs, Tarzungle into Zierer Tivolis.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES
 ('Jerudong Park Playground', 4.93694, 114.835, 'Brunei'),
 ('Gero Land', 30.171832, 31.476878, 'Egypt'),
 ('E-World', 35.8533, 128.5668, 'South Korea'),
 ('Zygo Park', 43.7180, 7.1960, 'France')
) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Junior Coaster','Jerudong Park Playground','Steel','Preston & Barbieri','Preston & Barbieri Junior Coaster',NULL,NULL,NULL,0,NULL,2014,'2014','year',NULL,NULL,1),
 ('Boomerang','Jerudong Park Playground','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1996,'1996','year','2006-06-01','year',1),
 ('Pony Express','Jerudong Park Playground','Steel','Zamperla','Zamperla Powered',NULL,NULL,1797.9,0,NULL,1995,'1995','year','2006-06-01','year',1),
 ('Pusing Lagi','Jerudong Park Playground','Steel','Vekoma','Vekoma Suspended Looping Coaster',101.7,44.7,2582.0,5,110,1997,'1997','year','2006-06-01','year',1),
 ('Boomerang','Gero Land','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1997,'1997','year',NULL,NULL,1),
 ('Junior Coaster','Gero Land','Steel','Vekoma','Vekoma Junior Coaster',42.7,28.5,1099.1,0,66,1997,'1997','year',NULL,NULL,1),
 ('Dragon','Gero Land','Steel','Zamperla','Zamperla Powered',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,1),
 ('Camel Back','E-World','Steel','Meisho',NULL,NULL,NULL,NULL,0,146,1995,'1995-03','month',NULL,NULL,1),
 ('Hurricane','E-World','Steel',NULL,NULL,NULL,NULL,NULL,3,NULL,1995,'1995-03','month',NULL,NULL,1),
 ('Magic Castle','E-World','Steel','EOS Rides',NULL,NULL,NULL,NULL,0,110,1995,'1995-03','month',NULL,NULL,1),
 ('Boomerang','E-World','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1995,'1995-03','month',NULL,NULL,1),
 ('Boomerang','Zygo Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1987,'1987','year','1991-06-01','year',1),
 ('Tarzungle','Zygo Park','Steel','Zierer','Zierer Tivoli',19.7,19.9,652.9,0,NULL,1987,'1987','year','1991-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Jerudong Park Playground', 'Gero Land', 'E-World', 'Zygo Park') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Jerudong Park Playground', 'Gero Land', 'E-World', 'Zygo Park') AND ((c.model = 'Vekoma Boomerang' AND g.name = 'Vekoma Boomerangs') OR (c.model = 'Vekoma Suspended Looping Coaster' AND g.name = 'Vekoma SLCs') OR (c.model = 'Zierer Tivoli' AND g.name = 'Zierer Tivolis')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Boomerang' AND h.park = 'Walygator Sud-Ouest' AND (c.id = h.id OR (c.name = 'Boomerang' AND c.park = 'Zygo Park'))) OR
 (h.name = 'Drako' AND h.park = 'Walibi Holland' AND (c.id = h.id OR (c.name = 'Tarzungle' AND c.park = 'Zygo Park')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '166') FROM coasters h WHERE ((h.name = 'Boomerang' AND h.park = 'Walygator Sud-Ouest') OR (h.name = 'Drako' AND h.park = 'Walibi Holland')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
