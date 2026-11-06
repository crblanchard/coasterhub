-- 171: more of Carter's RCDB screenshots, 2026-11-06 (Boomerang sweep, page 2).
-- Coordinates ESTIMATED (listed in missing-parks.md).
--   Siam Amazing Park: Grand Canyon Express (Zamperla powered coaster, ex
--     Jerudong's Pony Express; 2011-10 to 2021-02-28, in storage since, so closed)
--     and Loop the Loop (Meisho shuttle loop, 1981 unconfirmed; SBNO 2003-2021,
--     so closed 2003). Grand Canyon Express is the home (latest row).
--   Rafaela Padilla (Puebla, Mexico): Boomerang 1984-1986 -> Six Flags Mexico's
--     Batgirl Batarang (the home, running).
--   Family Fun (Duhok, Iraq): Boomerang (ex Karolinelund's, 2015-) and Looping
--     (Pinfari TL59 = Zyklon, ex Karolinelund's, 2015-). Family Fun is the home
--     for both. Karolinelund's Kålormen is there too as 'Unknown' (Pinfari Big Apple/Wacky Worm).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Rafaela Padilla', 19.0414, -98.2063, 'Mexico', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Rafaela Padilla');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Family Fun', 36.8670, 42.9880, 'Iraq', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Family Fun');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Grand Canyon Express','Siam Amazing Park','Steel','Zamperla','Zamperla Powered',NULL,NULL,1797.9,0,NULL,2011,'2011-10','month','2021-02-28','day',1),
 ('Loop the Loop','Siam Amazing Park','Steel','Meisho Amusement Machines','Meisho Loop the Loop',NULL,NULL,NULL,1,NULL,1981,'1981','year','2003','year',1),
 ('Boomerang','Rafaela Padilla','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1984,'1984','year','1986','year',1),
 ('Boomerang','Family Fun','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2015,'2015','year',NULL,NULL,1),
 ('Looping','Family Fun','Steel','Pinfari','Pinfari Zyklon',NULL,NULL,NULL,1,125,2015,'2015','year',NULL,NULL,1),
 ('Unknown','Family Fun','Steel','Pinfari','Wacky Worm',NULL,NULL,NULL,0,95,2015,'2015','year',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE (c.park IN ('Rafaela Padilla','Family Fun') OR (c.park = 'Siam Amazing Park' AND c.name IN ('Grand Canyon Express','Loop the Loop'))) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Rafaela Padilla','Family Fun') AND c.name = 'Boomerang' AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Grand Canyon Express' AND h.park = 'Siam Amazing Park' AND ((c.name = 'Grand Canyon Express' AND c.park = 'Siam Amazing Park') OR (c.name = 'Pony Express' AND c.park = 'Jerudong Park Playground'))) OR
 (h.name = 'Batgirl Batarang' AND h.park = 'Six Flags Mexico' AND ((c.name = 'Batgirl Batarang' AND c.park = 'Six Flags Mexico') OR (c.name = 'Boomerang' AND c.park = 'Rafaela Padilla'))) OR
 (h.name = 'Boomerang' AND h.park = 'Family Fun' AND ((c.name = 'Boomerang' AND c.park IN ('Family Fun','Tivoli Karolinelund')))) OR
 (h.name = 'Looping' AND h.park = 'Family Fun' AND ((c.name = 'Looping' AND c.park IN ('Family Fun','Tivoli Karolinelund')))) OR
 (h.name = 'Unknown' AND h.park = 'Family Fun' AND ((c.name = 'Unknown' AND c.park = 'Family Fun') OR (c.name = 'Kålormen' AND c.park = 'Tivoli Karolinelund')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '171') FROM coasters h WHERE ((h.name = 'Grand Canyon Express' AND h.park = 'Siam Amazing Park') OR (h.name = 'Batgirl Batarang' AND h.park = 'Six Flags Mexico') OR (h.name IN ('Boomerang','Looping','Unknown') AND h.park = 'Family Fun')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"171"%' AND json_extract(a.detail, '$.ride') = h.id);
