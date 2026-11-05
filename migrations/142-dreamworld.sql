-- 142: Dreamworld (Coomera, Queensland), from Carter's RCDB screenshots,
-- 2026-11-05 — more of its coasters may follow. Pin is an ESTIMATE.
--   Big Red Boat (Zamperla powered twin helix, 2023-12-22, 374 ft).
--   Gold Coaster (Arrow custom looper, 2001-12-26; 131.3 ft, 52.8 mph,
--     2,952.8 ft, 2 inversions). Former names Cyclone (2001-2015) and Hot Wheels
--     SideWinder (2015-2020). It is Luna Park Sydney's Big Dipper (1995-01-21 to
--     2001-01-27), so "Luna Park (Sydney)" is added — named like Luna Park
--     (Melbourne), since the bare "Luna Park" is Coney Island's — with that one
--     row, and the two are linked; Gold Coaster is the home.
--   Jungle Rush (Vekoma Switchback 460m, 2024-12-16).
--   Kenny's Forest Flyer (Vekoma SFC 342m, 2002-12-26; 48.6 ft, 26 mph, 1,122 ft,
--     1:30), into the Vekoma SFCs category. Former names Rugrats Runaway Reptar
--     (2002-2011), Sky Rocket (2011-2012), Escape from Madagascar (2012-2023),
--     Escape Coaster.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES ('Dreamworld', -27.8640, 153.3160, 'Australia'), ('Luna Park (Sydney)', -33.8476, 151.2099, 'Australia')) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Big Red Boat','Dreamworld','Steel','Zamperla','Zamperla Powered',NULL,NULL,374.0,0,NULL,2023,'2023-12-22','day',NULL,NULL,1),
 ('Gold Coaster','Dreamworld','Steel','Arrow Dynamics','Arrow Looper',131.3,52.8,2952.8,2,NULL,2001,'2001-12-26','day',NULL,NULL,1),
 ('Jungle Rush','Dreamworld','Steel','Vekoma','Vekoma Switchback',NULL,NULL,NULL,0,NULL,2024,'2024-12-16','day',NULL,NULL,1),
 ('Kenny''s Forest Flyer','Dreamworld','Steel','Vekoma','Vekoma Suspended Family Coaster',48.6,26.0,1122.0,0,90,2002,'2002-12-26','day',NULL,NULL,1),
 ('Big Dipper','Luna Park (Sydney)','Steel','Arrow Dynamics','Arrow Looper',131.3,52.8,2952.8,2,NULL,1995,'1995-01-21','day','2001-01-27','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Dreamworld', 'Luna Park (Sydney)') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.column2, 'rcdb', date('now') FROM coasters c JOIN (VALUES ('Gold Coaster','Cyclone'),('Gold Coaster','Hot Wheels SideWinder'),('Kenny''s Forest Flyer','Rugrats Runaway Reptar'),('Kenny''s Forest Flyer','Sky Rocket'),('Kenny''s Forest Flyer','Escape from Madagascar'),('Kenny''s Forest Flyer','Escape Coaster')) v ON v.column1 = c.name WHERE c.park = 'Dreamworld';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Kenny''s Forest Flyer' AND c.park = 'Dreamworld' AND g.name = 'Vekoma SFCs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Gold Coaster' AND h.park = 'Dreamworld' AND (c.id = h.id OR (c.name = 'Big Dipper' AND c.park = 'Luna Park (Sydney)'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '142') FROM coasters h WHERE h.name = 'Gold Coaster' AND h.park = 'Dreamworld' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
-- Then the rest of Carter's Dreamworld screenshots, plus Gumbuya World and
-- Warner Bros. Movie World (both pins ESTIMATES):
--   Dreamworld: Steel Taipan (MACK launch, 2021-12-14); Lost Mine Mayhem
--   (Intamin family launch, 2007-09-28; SBNO since 2/2026, stored operating;
--   former names Motocoaster, Mick Doohan's Motocoaster); BuzzSaw (Maurer
--   SkyLoop XT 150, 2011-09-17 to 2021-08-31) = Gumbuya World's Project Zero
--   (2022-12-23), linked, Project Zero the home; Eureka Mountain Mine Ride
--   (Schiff wild mouse, 1986-2006); Thunderbolt (Meisho double loop,
--   1982-05-01 to 2003-08-08); Tower of Terror II (Intamin reverse freefall,
--   1997 to 2019-11-03; "Tower of Terror" until 2010).
--   Movie World: DC Rivals HyperCoaster (MACK hyper, 2017-09-22), Flash: Speed
--   Force (Intamin Surfrider, 2024-05-13; its earlier Wet'n'Wild home is not
--   here), Flight of the Wicked Witch (Vekoma SFC 453m, 2024-12-20, into Vekoma
--   SFCs), Green Lantern Coaster (S&S El Loco, 2011-12-23), and Kansas Twister
--   as a twin pair, (Left) 738.2 ft / (Right) 721.8 ft (Vekoma Family Boomerang
--   Tweestryd, 2024-12-20). Which RCDB column is which side is a guess.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES ('Gumbuya World', -38.0970, 145.7210, 'Australia'), ('Warner Bros. Movie World', -27.9070, 153.3120, 'Australia')) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Steel Taipan','Dreamworld','Steel','MACK Rides','MACK Launch',128.0,65.2,3937.0,4,NULL,2021,'2021-12-14','day',NULL,NULL,1),
 ('Lost Mine Mayhem','Dreamworld','Steel','Intamin','Intamin Family Launch',23.0,44.7,1984.9,0,NULL,2007,'2007-09-28','day',NULL,NULL,1),
 ('BuzzSaw','Dreamworld','Steel','Maurer Rides','Maurer SkyLoop',151.6,65.3,492.2,2,50,2011,'2011-09-17','day','2021-08-31','day',1),
 ('Eureka Mountain Mine Ride','Dreamworld','Steel','B. A. Schiff','Schiff Wild Mouse',NULL,NULL,NULL,0,NULL,1986,'1986','year','2006-06-01','year',1),
 ('Thunderbolt','Dreamworld','Steel','Meisho','Meisho Double Loop',101.7,54.1,3960.0,2,NULL,1982,'1982-05-01','day','2003-08-08','day',1),
 ('Tower of Terror II','Dreamworld','Steel','Intamin','Intamin Reverse Freefall',377.3,100.0,1235.0,0,28,1997,'1997','year','2019-11-03','day',1),
 ('Project Zero','Gumbuya World','Steel','Maurer Rides','Maurer SkyLoop',151.6,65.3,492.2,2,50,2022,'2022-12-23','day',NULL,NULL,1),
 ('DC Rivals HyperCoaster','Warner Bros. Movie World','Steel','MACK Rides','MACK Hyper',202.0,71.5,4593.0,0,NULL,2017,'2017-09-22','day',NULL,NULL,1),
 ('Flash: Speed Force','Warner Bros. Movie World','Steel','Intamin','Intamin Surfrider',NULL,NULL,NULL,0,NULL,2024,'2024-05-13','day',NULL,NULL,1),
 ('Flight of the Wicked Witch','Warner Bros. Movie World','Steel','Vekoma','Vekoma Suspended Family Coaster',62.3,41.6,1489.5,0,NULL,2024,'2024-12-20','day',NULL,NULL,1),
 ('Green Lantern Coaster','Warner Bros. Movie World','Steel','S&S Worldwide','S&S El Loco',108.3,41.0,1601.1,2,NULL,2011,'2011-12-23','day',NULL,NULL,1),
 ('Kansas Twister (Left)','Warner Bros. Movie World','Steel','Vekoma','Vekoma Family Boomerang',72.2,36.0,738.2,0,NULL,2024,'2024-12-20','day',NULL,NULL,1),
 ('Kansas Twister (Right)','Warner Bros. Movie World','Steel','Vekoma','Vekoma Family Boomerang',72.2,36.0,721.8,0,NULL,2024,'2024-12-20','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Dreamworld', 'Gumbuya World', 'Warner Bros. Movie World') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.column2, 'rcdb', date('now') FROM coasters c JOIN (VALUES ('Lost Mine Mayhem','Motocoaster'),('Lost Mine Mayhem','Mick Doohan''s Motocoaster'),('Tower of Terror II','Tower of Terror')) v ON v.column1 = c.name WHERE c.park = 'Dreamworld';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Project Zero' AND h.park = 'Gumbuya World' AND (c.id = h.id OR (c.name = 'BuzzSaw' AND c.park = 'Dreamworld'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '142') FROM coasters h WHERE h.name = 'Project Zero' AND h.park = 'Gumbuya World' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Flight of the Wicked Witch' AND c.park = 'Warner Bros. Movie World' AND g.name = 'Vekoma SFCs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
-- And four more Movie World: Road Runner Roller Coaster (Vekoma Junior 335m,
-- 2000-12-26), SCOOBY-DOO! Spooky Coaster (MACK custom wild mouse, enclosed,
-- 2002-06-17; former name "Scooby-Doo Spooky Coaster"; SBNO 2023-2025 not
-- recorded), Superman Escape (Intamin accelerator, 2005-12-26), and Arkham
-- Asylum - Shock Therapy (Vekoma SLC 765m w/helix, 1995-12-26 to 12/2019;
-- "Lethal Weapon - The Ride" to 2011), into the Vekoma SLCs category.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Road Runner Roller Coaster','Warner Bros. Movie World','Steel','Vekoma','Vekoma Junior Coaster',42.7,28.5,1099.1,0,66,2000,'2000-12-26','day',NULL,NULL,1),
 ('SCOOBY-DOO! Spooky Coaster','Warner Bros. Movie World','Steel','MACK Rides','MACK Wild Mouse',55.8,28.0,1738.8,0,253,2002,'2002-06-17','day',NULL,NULL,1),
 ('Superman Escape','Warner Bros. Movie World','Steel','Intamin','Intamin Accelerator',131.3,62.1,NULL,0,NULL,2005,'2005-12-26','day',NULL,NULL,1),
 ('Arkham Asylum - Shock Therapy','Warner Bros. Movie World','Steel','Vekoma','Vekoma Suspended Looping Coaster',109.3,49.7,2509.8,5,102,1995,'1995-12-26','day','2019-12-01','month',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Warner Bros. Movie World' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.column2, 'rcdb', date('now') FROM coasters c JOIN (VALUES ('SCOOBY-DOO! Spooky Coaster','Scooby-Doo Spooky Coaster'),('Arkham Asylum - Shock Therapy','Lethal Weapon - The Ride')) v ON v.column1 = c.name WHERE c.park = 'Warner Bros. Movie World';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Arkham Asylum - Shock Therapy' AND c.park = 'Warner Bros. Movie World' AND g.name = 'Vekoma SLCs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
