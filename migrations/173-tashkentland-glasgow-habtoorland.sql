-- 173: Tashkentland, Glasgow Garden Festival and Habtoorland, from Carter's RCDB
-- screenshots, 2026-11-06 (Boomerang sweep, page 2). Coordinates ESTIMATED.
--   Tashkentland: Bumerang (Vekoma, 1995, operating).
--   Glasgow Garden Festival (1988): Coca-Cola Roller (Boomerang, 1988 only) ->
--     American Adventure's Missile (park not in DB yet) -> Pleasurewood Hills'
--     Wipeout (row 1511, already in D1 with no stats, running = the home). Wipeout
--     only gets its Boomerang stats filled in where blank (no activity row).
--   Habtoorland (Lebanon, opened 2004-12-23, SBNO 2009-2011 = removed; closed year
--     taken as 2011, the later end of RCDB's range): Colossus (Boomerang -> Wonderla
--     Kochi's Recoil), Mighty Worm (Pinfari Wacky Worm) and Twister (Maurer SC 3000
--     = 'Maurer Spinner' -> Wonderla Bhubaneswar's Spinning Coaster). The Wonderla
--     parks are not in the DB, so Colossus and Twister are not linked yet.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Tashkentland', 41.3560, 69.3000, 'Uzbekistan', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Tashkentland');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Glasgow Garden Festival', 55.8590, -4.2960, 'United Kingdom', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Glasgow Garden Festival');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Habtoorland', 33.8500, 35.5400, 'Lebanon', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Habtoorland');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Bumerang','Tashkentland','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1995,'1995','year',NULL,NULL,1),
 ('Coca-Cola Roller','Glasgow Garden Festival','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1988,'1988','year','1988','year',1),
 ('Colossus','Habtoorland','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2004,'2004-12-23','day','2011','year',1),
 ('Mighty Worm','Habtoorland','Steel','Pinfari','Wacky Worm',NULL,NULL,NULL,0,NULL,2004,'2004-12-23','day','2011','year',1),
 ('Twister','Habtoorland','Steel','Maurer Rides','Maurer Spinner',52.5,NULL,1525.6,0,NULL,2004,'2004-12-23','day','2011','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Tashkentland','Glasgow Garden Festival','Habtoorland') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE ((c.park = 'Tashkentland' AND c.name = 'Bumerang') OR (c.park = 'Glasgow Garden Festival' AND c.name = 'Coca-Cola Roller') OR (c.park = 'Habtoorland' AND c.name = 'Colossus') OR (c.park = 'Pleasurewood Hills' AND c.name = 'Wipeout')) AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
UPDATE coasters SET manu = COALESCE(manu, 'Vekoma'), model = COALESCE(model, 'Vekoma Boomerang'), h = COALESCE(h, 116.5), s = COALESCE(s, 47.0), l = COALESCE(l, 935.0), inv = COALESCE(inv, 3), dur = COALESCE(dur, 108) WHERE name = 'Wipeout' AND park = 'Pleasurewood Hills';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Wipeout' AND h.park = 'Pleasurewood Hills' AND (c.id = h.id OR (c.name = 'Coca-Cola Roller' AND c.park = 'Glasgow Garden Festival'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '173') FROM coasters h WHERE h.name = 'Wipeout' AND h.park = 'Pleasurewood Hills' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"173"%' AND json_extract(a.detail, '$.ride') = h.id);
