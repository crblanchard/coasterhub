-- 170: Qingdao International Beer City, Star Lake Amusement Park and Siam Amazing
-- Park, from Carter's RCDB screenshots, 2026-11-06 (Boomerang sweep, page 2).
-- Coordinates are ESTIMATED (pins to be corrected; listed in missing-parks.md).
--   Qingdao: Boomerang (Vekoma, 1998-07 to 2010; later at Floraland Continent
--     Park as Whirly Roller Coaster, not linked until that park is added) and an
--     unnamed Vekoma Junior Coaster 335m (1998-07 to 2010). SBNO 2010-12 not recorded.
--   Star Lake: Boomerang (1985 to 1990) -> Kentucky Kingdom's Vampire -> Six Flags
--     New England's Flashback; joins Flashback's group (Flashback is the home).
--   Siam Amazing Park: Boomerang (ex Jerudong, 2007 to 2026-09-27) and Vortex (SLC
--     787m Extended, ex Jerudong's Pusing Lagi, same dates). Both SBNO since
--     2026-09-28, so closed 2026-09-27; Siam is the latest row, hence the home.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Qingdao International Beer City', 36.0870, 120.4700, 'China', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Qingdao International Beer City');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Star Lake Amusement Park', 23.1650, 112.4750, 'China', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Star Lake Amusement Park');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Siam Amazing Park', 13.8625, 100.6811, 'Thailand', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Siam Amazing Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Boomerang','Qingdao International Beer City','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1998,'1998-07','month','2010','year',1),
 ('Unknown','Qingdao International Beer City','Steel','Vekoma','Vekoma Junior Coaster',42.7,28.5,1099.1,0,66,1998,'1998-07','month','2010','year',1),
 ('Boomerang','Star Lake Amusement Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1985,'1985','year','1990','year',1),
 ('Boomerang','Siam Amazing Park','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2007,'2007','year','2026-09-27','day',1),
 ('Vortex','Siam Amazing Park','Steel','Vekoma','Vekoma Suspended Looping Coaster',101.7,44.7,2582.0,5,110,2007,'2007','year','2026-09-27','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Qingdao International Beer City','Star Lake Amusement Park','Siam Amazing Park') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Qingdao International Beer City','Star Lake Amusement Park','Siam Amazing Park') AND ((c.name = 'Boomerang' AND g.name = 'Vekoma Boomerangs') OR (c.name = 'Vortex' AND g.name = 'Vekoma SLCs')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Flashback' AND h.park = 'Six Flags New England' AND c.name = 'Boomerang' AND c.park = 'Star Lake Amusement Park') OR
 (h.name = 'Boomerang' AND h.park = 'Siam Amazing Park' AND ((c.name = 'Boomerang' AND c.park IN ('Siam Amazing Park','Jerudong Park Playground')))) OR
 (h.name = 'Vortex' AND h.park = 'Siam Amazing Park' AND ((c.name = 'Vortex' AND c.park = 'Siam Amazing Park') OR (c.name = 'Pusing Lagi' AND c.park = 'Jerudong Park Playground')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '170') FROM coasters h WHERE ((h.name = 'Flashback' AND h.park = 'Six Flags New England') OR (h.name IN ('Boomerang','Vortex') AND h.park = 'Siam Amazing Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"170"%' AND json_extract(a.detail, '$.ride') = h.id);
