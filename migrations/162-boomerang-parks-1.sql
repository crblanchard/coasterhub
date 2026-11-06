-- 162: the first Boomerang parks from Carter's list (2026-11-06), with their
-- coasters from his RCDB screenshots. English names only. Coordinates looked up
-- (Wikipedia; Hafan y Môr from VisitWales). Boomerangs go into Vekoma Boomerangs.
-- Luna Park Tel Aviv: Anaconda (Boomerang, 2000), Rakevet Harim (Vekoma Junior
--   335m, 2010-03-14), Twister (EOS Crazy Twister spinner, 2011), and Rakevet
--   Harim (Old) (Pinfari Zyklon Z47, 1980-2010) — "(Old)" as with Wildcat.
-- Pleasure Island Family Theme Park (Cleethorpes, closed 2016): Boomerang
--   (1993-05-27 to 2016-10-29; later Trans Studio Bali, not here), Crazy Loop
--   (Pinfari TL59, 1996-03-31 to 2002) = Brean's Crazy Loop, linked (Brean the
--   home), Four Man Bob (Zierer, 1993-05-27 to 1995) = Alton Towers' 4 Man Bob,
--   linked (Pleasure Island, the later stop we have, is the home), Go Gator
--   (A.R.M. powered kiddie, 1993-2016; not a Wisdom Go Gator, so not in that
--   category), Mini Mine Train (Vekoma Junior 207m, 1993-2016).
-- Hafan y Môr Holiday Park (Pwllheli): Boomerang (1987-1998; later Dixie
--   Landin's Ragin' Cajun, not here).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES
 ('Luna Park Tel Aviv', 32.106279, 34.812026, 'Israel'),
 ('Pleasure Island Family Theme Park', 53.543406, -0.008189, 'United Kingdom'),
 ('Hafan y Môr Holiday Park', 52.90599, -4.3341, 'United Kingdom')
) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Anaconda','Luna Park Tel Aviv','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2000,'2000','year',NULL,NULL,1),
 ('Rakevet Harim','Luna Park Tel Aviv','Steel','Vekoma','Vekoma Junior Coaster',NULL,NULL,1099.1,0,NULL,2010,'2010-03-14','day',NULL,NULL,1),
 ('Twister','Luna Park Tel Aviv','Steel','EOS Rides','EOS Spinning Coaster',NULL,NULL,360.9,0,NULL,2011,'2011','year',NULL,NULL,1),
 ('Rakevet Harim (Old)','Luna Park Tel Aviv','Steel','Pinfari','Pinfari Zyklon',NULL,NULL,NULL,0,NULL,1980,'1980','year','2010-06-01','year',1),
 ('Boomerang','Pleasure Island Family Theme Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1993,'1993-05-27','day','2016-10-29','day',1),
 ('Crazy Loop','Pleasure Island Family Theme Park','Steel','Pinfari','Pinfari Zyklon',36.1,NULL,1197.5,1,NULL,1996,'1996-03-31','day','2002-06-01','year',1),
 ('Four Man Bob','Pleasure Island Family Theme Park','Steel','Zierer','Zierer Four Man Bob',21.3,NULL,NULL,0,NULL,1993,'1993-05-27','day','1995-06-01','year',1),
 ('Go Gator','Pleasure Island Family Theme Park','Steel','A.R.M.',NULL,NULL,NULL,NULL,0,NULL,1993,'1993-05-27','day','2016-10-29','day',1),
 ('Mini Mine Train','Pleasure Island Family Theme Park','Steel','Vekoma','Vekoma Junior Coaster',27.9,21.7,679.1,0,44,1993,'1993-05-27','day','2016-10-29','day',1),
 ('Boomerang','Hafan y Môr Holiday Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1987,'1987','year','1998-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Luna Park Tel Aviv', 'Pleasure Island Family Theme Park', 'Hafan y Môr Holiday Park') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Luna Park Tel Aviv', 'Pleasure Island Family Theme Park', 'Hafan y Môr Holiday Park') AND c.model = 'Vekoma Boomerang' AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Crazy Loop' AND h.park = 'Brean Theme Park' AND (c.id = h.id OR (c.name = 'Crazy Loop' AND c.park = 'Pleasure Island Family Theme Park'))) OR
 (h.name = 'Four Man Bob' AND h.park = 'Pleasure Island Family Theme Park' AND (c.id = h.id OR (c.name = '4 Man Bob' AND c.park = 'Alton Towers')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '162') FROM coasters h WHERE ((h.name = 'Crazy Loop' AND h.park = 'Brean Theme Park') OR (h.name = 'Four Man Bob' AND h.park = 'Pleasure Island Family Theme Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
