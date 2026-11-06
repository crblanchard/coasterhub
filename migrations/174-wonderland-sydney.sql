-- 174: Wonderland Sydney (Eastern Creek, NSW; closed 2004-04-26), from Carter's
-- RCDB screenshots, 2026-11-06. Last of the Boomerang sweep's page 2. Pin ESTIMATED.
--   Beastie (PTC family wood, 1985 to 2002; "Little Wonderland" closed two years
--     early) and Bush Beast (PTC wood, 1985 to 2004-04-26). SBNO years not recorded.
--   Demon (Vekoma Boomerang, 1992 to 2004-04-26) -> World Expo Park's Titan (not in
--     DB) -> Alabama Adventure's Zoomerang (row 1299) -> Wonderla Hyderabad's
--     Recoil (not in DB). Linked to Zoomerang as the home for now; when Wonderla
--     Hyderabad is added Recoil is probably the home (re-point the group then).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Wonderland Sydney', -33.8030, 150.8680, 'Australia', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Wonderland Sydney');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Beastie','Wonderland Sydney','Wood','Philadelphia Toboggan Coasters','PTC Wood',48.9,37.3,1499.3,0,130,1985,'1985','year','2002','year',1),
 ('Bush Beast','Wonderland Sydney','Wood','Philadelphia Toboggan Coasters','PTC Wood',90.3,55.9,NULL,0,NULL,1985,'1985','year','2004-04-26','day',1),
 ('Demon','Wonderland Sydney','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1992,'1992','year','2004-04-26','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Wonderland Sydney' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Wonderland Sydney' AND c.name = 'Demon' AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Zoomerang' AND h.park = 'Alabama Adventure' AND (c.id = h.id OR (c.name = 'Demon' AND c.park = 'Wonderland Sydney'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '174') FROM coasters h WHERE h.name = 'Zoomerang' AND h.park = 'Alabama Adventure' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"174"%' AND json_extract(a.detail, '$.ride') = h.id);
