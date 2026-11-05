-- 139: Adventure Park USA (Monrovia MD) and Old Town (Kissimmee FL), from
-- Carter's RCDB screenshots, 2026-11-05. Both pins are ESTIMATES (missing-parks.md).
--   Adventure Park USA: Tumbleweed (Miler kiddie, 2015) = Jolly Roger's
--     Sea Serpent (Old); Wild West Express (Zamperla Windstorm, 2015-05-15) =
--     Old Town's Windstorm (1997-02-15 to 2014); Wildcat (Schwarzkopf Wildcat
--     54m, 2007-03-30) = Busch Gardens Williamsburg's Die Wildkatze (1976-1983)
--     and Playland Park's Wild Cat (1984-1991), both added. Its Steel Pier
--     (1994-1999) and Williams Grove (2001-2005) stops are parks we don't have.
--   Old Town: Windstorm, Wacky Worm (Fajume, 2008-2014; now Santa's Village's,
--     which becomes the set's home) and Dragon Wagon (Wisdom, 1998-2008; now a
--     UK travelling ride, not here).
-- The running copy is each set's home. Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES ('Adventure Park USA', 39.3640, -77.2620, 'Maryland, US'), ('Old Town', 28.3320, -81.5100, 'Florida, US')) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Tumbleweed','Adventure Park USA','Steel','Miler Manufacturing','Miler Kiddie',NULL,NULL,NULL,0,NULL,2015,'2015','year',NULL,NULL,1),
 ('Wild West Express','Adventure Park USA','Steel','Zamperla','Zamperla Windstorm',53.0,NULL,1437.0,0,NULL,2015,'2015-05-15','day',NULL,NULL,1),
 ('Wildcat','Adventure Park USA','Steel','Schwarzkopf','Schwarzkopf Wildcat',44.3,NULL,1509.2,0,NULL,2007,'2007-03-30','day',NULL,NULL,1),
 ('Windstorm','Old Town','Steel','Zamperla','Zamperla Windstorm',53.0,NULL,1437.0,0,NULL,1997,'1997-02-15','day','2014-06-01','year',1),
 ('Wacky Worm','Old Town','Steel','Fajume','Wacky Worm',NULL,NULL,NULL,0,NULL,2008,'2008','year','2014-06-01','year',1),
 ('Dragon Wagon','Old Town','Steel','Wisdom Rides','Wisdom Dragon Wagon',NULL,NULL,NULL,0,NULL,1998,'1998','year','2008-06-01','year',1),
 ('Die Wildkatze','Busch Gardens Williamsburg','Steel','Schwarzkopf','Schwarzkopf Wildcat',44.3,NULL,1509.2,0,NULL,1976,'1976','year','1983-06-01','year',1),
 ('Wild Cat','Playland Park','Steel','Schwarzkopf','Schwarzkopf Wildcat',44.3,NULL,1509.2,0,NULL,1984,'1984','year','1991-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE (c.park IN ('Adventure Park USA', 'Old Town') OR (c.name = 'Die Wildkatze' AND c.park = 'Busch Gardens Williamsburg') OR (c.name = 'Wild Cat' AND c.park = 'Playland Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Old Town' AND ((c.name = 'Wacky Worm' AND g.name = 'Wacky Worms') OR (c.name = 'Dragon Wagon' AND g.name = 'Dragon Wagons')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Tumbleweed' AND h.park = 'Adventure Park USA' AND (c.id = h.id OR (c.name = 'Sea Serpent (Old)' AND c.park = 'Jolly Roger Amusement Park'))) OR
 (h.name = 'Wild West Express' AND h.park = 'Adventure Park USA' AND (c.id = h.id OR (c.name = 'Windstorm' AND c.park = 'Old Town'))) OR
 (h.name = 'Wildcat' AND h.park = 'Adventure Park USA' AND (c.id = h.id OR (c.name = 'Die Wildkatze' AND c.park = 'Busch Gardens Williamsburg') OR (c.name = 'Wild Cat' AND c.park = 'Playland Park'))) OR
 (h.name = 'Wacky Worm' AND h.park = 'Santa''s Village Amusement and Water Park' AND (c.id = h.id OR (c.name = 'Wacky Worm' AND c.park = 'Old Town')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '139') FROM coasters h WHERE ((h.park = 'Adventure Park USA') OR (h.name = 'Wacky Worm' AND h.park = 'Santa''s Village Amusement and Water Park')) AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) > 1 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
-- Then three more:
--   Rails (Valleyfair, Schwarzkopf Wildcat 65m, 1979-1998; "Wild Rails" to
--     1995, kept as a former name) — the stop between Cedar Point's Wildcat
--     (Old) and Jolly Roger's Wildcat, so it joins that set.
--   Mad Mouse (Quassy, Allan Herschell Monster Mouse, 1982-2010) — Playland
--     Park's Monster Mouse moved there. Neither runs now; Quassy, the later
--     home, is the set's home.
--   Wild Mouse (Quassy, B. A. Schiff large wild mouse, 1960-1983).
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Rails','Valleyfair','Steel','Schwarzkopf','Schwarzkopf Wildcat',NULL,NULL,NULL,0,NULL,1979,'1979','year','1998-06-01','year',1),
 ('Mad Mouse','Quassy Amusement Park','Steel','Allan Herschell','Allan Herschell Monster Mouse',NULL,NULL,NULL,0,NULL,1982,'1982','year','2010-06-01','year',1),
 ('Wild Mouse','Quassy Amusement Park','Steel','B. A. Schiff','Schiff Wild Mouse',NULL,NULL,NULL,0,NULL,1960,'1960','year','1983-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE ((c.name = 'Rails' AND c.park = 'Valleyfair') OR (c.park = 'Quassy Amusement Park' AND c.name IN ('Mad Mouse', 'Wild Mouse'))) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Wild Rails', 'rcdb', date('now') FROM coasters WHERE name = 'Rails' AND park = 'Valleyfair';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Wildcat' AND h.park = 'Jolly Roger Amusement Park' AND c.name = 'Rails' AND c.park = 'Valleyfair') OR
 (h.name = 'Mad Mouse' AND h.park = 'Quassy Amusement Park' AND (c.id = h.id OR (c.name = 'Monster Mouse' AND c.park = 'Playland Park')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '139') FROM coasters h WHERE ((h.name = 'Wildcat' AND h.park = 'Jolly Roger Amusement Park') OR (h.name = 'Mad Mouse' AND h.park = 'Quassy Amusement Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"139"%' AND json_extract(a.detail, '$.ride') = h.id);
