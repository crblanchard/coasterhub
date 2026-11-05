-- 147: Toverland's Wilde Maus (MACK Wilde Maus Compact Mobile, 2004-07-03 to
-- 2004-08-02 — a stand-in while Booster Bike ran late), from Carter's RCDB
-- screenshot, 2026-11-05. Its other homes — Walygator Grand Est (as Zig Zag;
-- the park is here, but no dates for that stop), Sommerland Syd and Freizeit-Land
-- Geiselwind — are not linked; see missing-parks.md. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Wilde Maus', 'Toverland', 'Steel', 'MACK Rides', 'MACK Wild Mouse', 45.9, 28.0, 1213.9, 0, 110, 2004, '2004-07-03', 'day', '2004-08-02', 'day', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wilde Maus' AND park = 'Toverland');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Wilde Maus' AND c.park = 'Toverland' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- Then Carter sent the whole chain. One travelling MACK Wilde Maus (Compact
-- Mobile, mirror-image; showman Kinzler): Walygator Grand Est as Zig Zag
-- (2003-05-08 to 2003), Toverland (2004), Sommerland Syd (2010-06-25 to
-- 2010-09-12), Freizeit-Land Geiselwind (2011-04-16 to 2011-10-16). All four are
-- linked as one ride; the last stop, Geiselwind, is the home. Two parks added,
-- coordinates looked up (Geiselwind: Wikipedia; Sommerland Syd: Wikimedia-
-- derived listing, Sommervej 4, Tinglev).
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES ('Sommerland Syd', 54.96300, 9.18083, 'Denmark'), ('Freizeit-Land Geiselwind', 49.78028, 10.45750, 'Germany')) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Zig Zag','Walygator Grand Est','Steel','MACK Rides','MACK Wild Mouse',45.9,28.0,1213.9,0,110,2003,'2003-05-08','day','2003-09-01','year',1),
 ('Wilde Maus','Sommerland Syd','Steel','MACK Rides','MACK Wild Mouse',45.9,28.0,1213.9,0,110,2010,'2010-06-25','day','2010-09-12','day',1),
 ('Wilde Maus','Freizeit-Land Geiselwind','Steel','MACK Rides','MACK Wild Mouse',45.9,28.0,1213.9,0,110,2011,'2011-04-16','day','2011-10-16','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE ((c.name = 'Zig Zag' AND c.park = 'Walygator Grand Est') OR (c.name = 'Wilde Maus' AND c.park IN ('Sommerland Syd', 'Freizeit-Land Geiselwind'))) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Wilde Maus' AND h.park = 'Freizeit-Land Geiselwind' AND (c.id = h.id OR (c.name = 'Wilde Maus' AND c.park IN ('Toverland', 'Sommerland Syd')) OR (c.name = 'Zig Zag' AND c.park = 'Walygator Grand Est'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '147') FROM coasters h WHERE h.name = 'Wilde Maus' AND h.park = 'Freizeit-Land Geiselwind' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
