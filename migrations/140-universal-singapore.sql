-- 140: Universal Studios Singapore (Sentosa), from Carter's RCDB screenshots,
-- 2026-11-05. Pin is an ESTIMATE (missing-parks.md).
--   Battlestar Galactica, two rows as usual for a duelling pair (Carter: "make
--   battlestar galactica two separate entries as usual. call them both vekoma
--   launch") — "(Cylon)" and "(Human)" so the racing-pair code groups them.
--   Cylon: 3,185.7 ft, 5 inversions; Human: 3,221.8 ft, 0. Both 140.1 ft,
--   55.9 mph, 1:30, 2010-03-18. (SBNO 2013-2015 not recorded.)
--   Canopy Flyer (Setpoint Swing Thing, 2010-03-18), Enchanted Airways (Vekoma
--   Junior 335m, 2010-03-18), Puss In Boots' Giant Journey (Zamperla
--   Nineinverted, 2015-04-08), Revenge of the Mummy (Premier launch, 2010-03-18).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Universal Studios Singapore', 1.2540, 103.8238, 'Singapore', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Universal Studios Singapore');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Battlestar Galactica (Cylon)','Universal Studios Singapore','Steel','Vekoma','Vekoma Launch',140.1,55.9,3185.7,5,90,2010,'2010-03-18','day',NULL,NULL,1),
 ('Battlestar Galactica (Human)','Universal Studios Singapore','Steel','Vekoma','Vekoma Launch',140.1,55.9,3221.8,0,90,2010,'2010-03-18','day',NULL,NULL,1),
 ('Canopy Flyer','Universal Studios Singapore','Steel','Setpoint','Setpoint Swing Thing',NULL,NULL,NULL,0,NULL,2010,'2010-03-18','day',NULL,NULL,1),
 ('Enchanted Airways','Universal Studios Singapore','Steel','Vekoma','Vekoma Junior Coaster',NULL,NULL,1099.1,0,NULL,2010,'2010-03-18','day',NULL,NULL,1),
 ('Puss In Boots'' Giant Journey','Universal Studios Singapore','Steel','Zamperla','Zamperla Nineinverted',56.8,24.9,1404.2,0,NULL,2015,'2015-04-08','day',NULL,NULL,1),
 ('Revenge of the Mummy','Universal Studios Singapore','Steel','Premier Rides','Premier Launch',44.4,40.0,2200.0,0,117,2010,'2010-03-18','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Universal Studios Singapore' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
