-- 178: Salitre Magico (Bogotá) rides from Carter's RCDB screenshots,
-- 2026-11-17. The park was already in. Safe to run twice.
--   Drakko: The Flying Beast (Premier Sky Rocket II, 2023-08-24) = Bosque
--     Magico's Zombie Ride (2015-2022), linked, Drakko the home.
--   Magnus (Arrow Corkscrew, 2000; earlier name "Montaña Rusa"). Its first two
--     stops, Magic Harbor and Myrtle Beach Pavilion (both "Corkscrew"), are not
--     in the database: noted in missing-parks.md.
--   Gusano Loco (Big Apple Wacky Worm, by 2001-04-01).
--   Rallus (Vekoma MK-1200 Whirlwind, 2026-10-17) = Bosque Magico's Tornado
--     (2001-2022), linked, Rallus the home. Its Bobbejaanland stop (Wervelwind)
--     has no row yet: noted.
--   Tornado (Schwarzkopf Jumbo Jet, 2010-2017) = Alton Towers' New Beast,
--     linked, this Tornado the home (its last stop). Morey's Piers (Jumbo Jet)
--     and Divertido (Space Mountain) stops are not in: noted.
--   Montana Rusa (Meisho figure eight, 1973-1975 to 1997-2000): sent by Carter,
--     so in despite closing last century; opened/closed by the later years.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Drakko: The Flying Beast','Salitre Magico','Steel','Premier Rides','Premier Sky Rocket II',150.0,62.0,863.0,1,NULL,2023,'2023-08-24','day',NULL,NULL,1),
 ('Magnus','Salitre Magico','Steel','Arrow Dynamics','Arrow Corkscrew',70.0,NULL,1250.0,2,70,2000,'2000','year',NULL,NULL,1),
 ('Gusano Loco','Salitre Magico','Steel','Big Apple','Wacky Worm',NULL,NULL,NULL,0,NULL,2001,'2001','year',NULL,NULL,1),
 ('Rallus','Salitre Magico','Steel','Vekoma','Vekoma MK-1200',64.0,37.3,1148.3,2,NULL,2026,'2026-10-17','day',NULL,NULL,1),
 ('Tornado','Salitre Magico','Steel','Schwarzkopf','Schwarzkopf Jumbo Jet',NULL,44.0,2862.0,0,NULL,2010,'2010','year','2017','year',1),
 ('Montana Rusa','Salitre Magico','Steel','Meisho Amusement Machines',NULL,NULL,NULL,NULL,0,NULL,1975,'1975','year','2000','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Salitre Magico' AND c.name IN ('Drakko: The Flying Beast','Magnus','Gusano Loco','Rallus','Tornado','Montana Rusa') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Montaña Rusa', 'rcdb', date('now') FROM coasters WHERE park = 'Salitre Magico' AND name = 'Magnus';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Salitre Magico' AND ((c.name = 'Drakko: The Flying Beast' AND g.name = 'Sky Rocket IIs') OR (c.name = 'Gusano Loco' AND g.name = 'Wacky Worms')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters h, coasters c WHERE h.park = 'Salitre Magico' AND (
 (h.name = 'Drakko: The Flying Beast' AND (c.id = h.id OR (c.name = 'Zombie Ride' AND c.park = 'Bosque Magico'))) OR
 (h.name = 'Rallus' AND (c.id = h.id OR (c.name = 'Tornado' AND c.park = 'Bosque Magico'))) OR
 (h.name = 'Tornado' AND (c.id = h.id OR (c.name = 'New Beast' AND c.park = 'Alton Towers'))));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '178') FROM coasters h WHERE h.park = 'Salitre Magico' AND h.name IN ('Drakko: The Flying Beast','Rallus','Tornado') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"178"%' AND json_extract(a.detail, '$.ride') = h.id);
