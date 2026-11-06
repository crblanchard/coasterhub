-- 175: Wonderla Hyderabad (opened 2016-04-07), from Carter's RCDB screenshots,
-- 2026-11-06. Pin ESTIMATED. Recoil (Vekoma Boomerang) is the running end of the
-- Wonderland Sydney Demon -> World Expo Park Titan -> Alabama Adventure Zoomerang
-- chain, so it becomes the home: Zoomerang's group is re-pointed at it.
-- Termite Coaster (Wacky Worm), Termite Train (kiddie powered coaster) and Wonder
-- Splash have no maker/stats on RCDB, so those stay NULL. Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Wonderla Hyderabad', 17.2330, 78.6050, 'India', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Wonderla Hyderabad');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Recoil','Wonderla Hyderabad','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2016,'2016-04-07','day',NULL,NULL,1),
 ('Termite Coaster','Wonderla Hyderabad','Steel',NULL,'Wacky Worm',NULL,NULL,NULL,0,NULL,2016,'2016-04-07','day',NULL,NULL,1),
 ('Termite Train','Wonderla Hyderabad','Steel',NULL,'Powered Coaster',NULL,NULL,NULL,0,NULL,2016,'2016-04-07','day',NULL,NULL,1),
 ('Wonder Splash','Wonderla Hyderabad','Steel',NULL,NULL,NULL,NULL,NULL,0,NULL,2016,'2016-04-07','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Wonderla Hyderabad' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Wonderla Hyderabad' AND c.name = 'Recoil' AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
UPDATE same_ride SET ride = (SELECT id FROM coasters WHERE name = 'Recoil' AND park = 'Wonderla Hyderabad') WHERE ride = (SELECT id FROM coasters WHERE name = 'Zoomerang' AND park = 'Alabama Adventure');
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT id, id FROM coasters WHERE name = 'Recoil' AND park = 'Wonderla Hyderabad';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '175') FROM coasters h WHERE h.name = 'Recoil' AND h.park = 'Wonderla Hyderabad' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"175"%' AND json_extract(a.detail, '$.ride') = h.id);
