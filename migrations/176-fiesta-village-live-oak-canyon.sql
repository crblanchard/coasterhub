-- 176: Fiesta Village Family Fun Park (Colton, CA) and Live Oak Canyon Farm
-- (Redlands, CA), from Carter's RCDB screenshots, 2026-11-11. Coordinates from
-- Carter.
--   Fiesta Village: Dragon Roller Coaster (Wisdom Orient Express, 2016-2019;
--     the SBNO 2020-2021 is not recorded).
--   Live Oak: Dragon Ride (Orient Express, since 2023), Spinning Coaster
--     (SBF Visa, since 2021; also called "Spinning Cow Coaster"), Wacky Worm
--     (Big Apple, since 2025). Spinning Coaster "may be" the one from Western
--     Playland - RCDB is unsure, so not linked.
--   One Orient Express moved Sonoma TrainTown (Dragon Train, existing row 678,
--     to 2014) -> Fiesta Village -> Live Oak. All three linked, Dragon Ride the
--     home (running now). Dragon Train's maker was typo'd 'Widsom Rides'; fixed
--     (no activity row).
--   Also at Live Oak, both removed: a Wisdom Dragon Wagon also called Dragon
--     Ride (2021-2022, Ontario plate) -> 'Dragon Ride (Old)' since the Orient
--     Express one is newer and keeps the plain name; and Miner Mike (Wisdom
--     powered kiddie, 2018 to 2021-2022, closed read as 2022).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Fiesta Village Family Fun Park', 34.04856262179547, -117.3035480886459, 'California, US', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fiesta Village Family Fun Park');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Live Oak Canyon Farm', 34.01410312985519, -117.0976983045845, 'California, US', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Live Oak Canyon Farm');
UPDATE coasters SET manu = 'Wisdom Rides' WHERE name = 'Dragon Train' AND park = 'Sonoma TrainTown Railroad' AND manu = 'Widsom Rides';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Dragon Roller Coaster','Fiesta Village Family Fun Park','Steel','Wisdom Rides','Wisdom Orient Express',NULL,NULL,NULL,0,NULL,2016,'2016','year','2019','year',1),
 ('Dragon Ride','Live Oak Canyon Farm','Steel','Wisdom Rides','Wisdom Orient Express',NULL,NULL,NULL,0,NULL,2023,'2023','year',NULL,NULL,1),
 ('Dragon Ride (Old)','Live Oak Canyon Farm','Steel','Wisdom Rides','Wisdom Dragon Wagon',NULL,NULL,NULL,0,NULL,2021,'2021','year','2022','year',1),
 ('Miner Mike','Live Oak Canyon Farm','Steel','Wisdom Rides','Miner Mike',NULL,NULL,NULL,0,NULL,2018,'2018','year','2022','year',1),
 ('Spinning Coaster','Live Oak Canyon Farm','Steel','SBF Visa','SBF Visa Spinner',NULL,NULL,NULL,0,NULL,2021,'2021','year',NULL,NULL,1),
 ('Wacky Worm','Live Oak Canyon Farm','Steel','Big Apple','Wacky Worm',NULL,NULL,NULL,0,NULL,2025,'2025','year',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Fiesta Village Family Fun Park', 'Live Oak Canyon Farm') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Spinning Cow Coaster', 'rcdb', date('now') FROM coasters WHERE park = 'Live Oak Canyon Farm' AND name = 'Spinning Coaster';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Fiesta Village Family Fun Park', 'Live Oak Canyon Farm') AND ((c.name = 'Dragon Ride (Old)' AND g.name = 'Dragon Wagons') OR (c.name = 'Miner Mike' AND g.name = 'Miner Mikes') OR (c.name IN ('Dragon Roller Coaster','Dragon Ride') AND g.name = 'Orient Expresses') OR (c.name = 'Spinning Coaster' AND g.name = 'SBF Visa Spinners') OR (c.name = 'Wacky Worm' AND g.name = 'Wacky Worms')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters h, coasters c WHERE h.name = 'Dragon Ride' AND h.park = 'Live Oak Canyon Farm' AND ((c.name = 'Dragon Ride' AND c.park = 'Live Oak Canyon Farm') OR (c.name = 'Dragon Roller Coaster' AND c.park = 'Fiesta Village Family Fun Park') OR (c.name = 'Dragon Train' AND c.park = 'Sonoma TrainTown Railroad'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '176') FROM coasters h WHERE h.name = 'Dragon Ride' AND h.park = 'Live Oak Canyon Farm' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"176"%' AND json_extract(a.detail, '$.ride') = h.id);
