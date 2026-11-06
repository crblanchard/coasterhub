-- 161: Fantasilandia (Santiago, Chile), with Carter's coordinates and RCDB
-- screenshots, 2026-11-06. Five operating coasters:
--   Boomerang (Vekoma, 1996; SBNO most of 2015, not recorded) into Vekoma
--     Boomerangs. Car City (SBF Visa double mine train extended, 2024-12-19).
--   Montaña Dragón (Zamperla powered twin helix, "<= 2004", no date).
--   Raptor (Vekoma SLC 689m, 2008-12-23) into Vekoma SLCs; its first home, the
--     International Dream Exchange Fair (Japan, as Dream Thunder), is not here.
--   Tren Minero (Vekoma mine train 785m, 2015-11-14) = Ratanga Junction's
--     Diamond Devil Run, linked; Tren Minero (runs now) is the home.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Fantasilandia', -33.459012, -70.663105, 'Chile', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fantasilandia');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Boomerang','Fantasilandia','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1996,'1996','year',NULL,NULL,1),
 ('Car City','Fantasilandia','Steel','SBF Visa','SBF Visa Double Mine Train',NULL,NULL,NULL,0,NULL,2024,'2024-12-19','day',NULL,NULL,1),
 ('Montaña Dragón','Fantasilandia','Steel','Zamperla','Zamperla Powered',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,1),
 ('Raptor','Fantasilandia','Steel','Vekoma','Vekoma Suspended Looping Coaster',109.3,49.7,2260.5,5,96,2008,'2008-12-23','day',NULL,NULL,1),
 ('Tren Minero','Fantasilandia','Steel','Vekoma','Mine Train',45.9,30.1,2575.5,0,180,2015,'2015-11-14','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Fantasilandia' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Fantasilandia' AND ((c.name = 'Boomerang' AND g.name = 'Vekoma Boomerangs') OR (c.name = 'Raptor' AND g.name = 'Vekoma SLCs')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Tren Minero' AND h.park = 'Fantasilandia' AND (c.id = h.id OR (c.name = 'Diamond Devil Run' AND c.park = 'Ratanga Junction'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '161') FROM coasters h WHERE h.name = 'Tren Minero' AND h.park = 'Fantasilandia' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
