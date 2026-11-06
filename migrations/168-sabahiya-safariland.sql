-- 168: South Sabahiya Park (Kuwait) and Safariland Stukenbrock, from Carter's
-- RCDB screenshots, 2026-11-06. Coordinates: Safariland from Wikipedia/
-- Wikidata; South Sabahiya from a Kuwait directory listing (29.0890, 48.1015).
--   The Vekoma MK-1200: Flying Tiger at Safariland (1981 to 2021-10-31, "Super
--     Tornado" to 2007) -> Vekoma Tsunami at South Sabahiya (2023-12-13 to
--     2026) -> Lightwater Valley "Unknown", track on site, opening 2027. Linked,
--     the Lightwater row the home.
--   South Sabahiya's others: Dragon (Zamperla powered, 2024-10-23),
--     Grand Canyon (CAM Baby Kart mine train, 2023-12-13), €uro Coaster (SBF
--     Visa, 2023-12-13 to 2025; its Funland Theme Park stop is not here), Nessi
--     Coaster (Cavazza Diego, 2004 to 2015), Ultra Coaster (TOGO Ultra Twister,
--     2008 to 2012; its Ikoma Skyland stop is not here), Spinning Racer (Maurer
--     SC 2000, 2023-12-13 to 2025) = Fantasy Island's Spinning Racer, linked.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Safariland Stukenbrock', 51.889167, 8.680833, 'Germany', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Safariland Stukenbrock');
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'South Sabahiya Park', 29.088987, 48.101502, 'Kuwait', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'South Sabahiya Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Flying Tiger','Safariland Stukenbrock','Steel','Vekoma','Vekoma MK-1200',64.0,37.3,1148.3,2,NULL,1981,'1981','year','2021-10-31','day',1),
 ('Vekoma Tsunami','South Sabahiya Park','Steel','Vekoma','Vekoma MK-1200',64.0,37.3,1148.3,2,NULL,2023,'2023-12-13','day','2026','year',1),
 ('Unknown','Lightwater Valley','Steel','Vekoma','Vekoma MK-1200',64.0,37.3,1148.3,2,NULL,2027,'2027','year',NULL,NULL,1),
 ('Dragon','South Sabahiya Park','Steel','Zamperla','Zamperla Powered',NULL,NULL,NULL,0,NULL,2024,'2024-10-23','day',NULL,NULL,1),
 ('Grand Canyon','South Sabahiya Park','Steel','CAM Baby Kart',NULL,NULL,NULL,NULL,0,NULL,2023,'2023-12-13','day',NULL,NULL,1),
 ('€uro Coaster','South Sabahiya Park','Steel','SBF Visa',NULL,NULL,NULL,NULL,0,NULL,2023,'2023-12-13','day','2025','year',1),
 ('Nessi Coaster','South Sabahiya Park','Steel','Cavazza Diego',NULL,NULL,NULL,NULL,0,NULL,2004,'2004','year','2015','year',1),
 ('Ultra Coaster','South Sabahiya Park','Steel','TOGO','TOGO Ultra Twister',105.0,NULL,NULL,3,NULL,2008,'2008','year','2012','year',1),
 ('Spinning Racer','South Sabahiya Park','Steel','Maurer Rides','Maurer Spinner',50.9,37.3,1378.0,0,NULL,2023,'2023-12-13','day','2025','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE (c.park IN ('South Sabahiya Park', 'Safariland Stukenbrock') OR (c.name = 'Unknown' AND c.park = 'Lightwater Valley')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Super Tornado', 'rcdb', date('now') FROM coasters WHERE park = 'Safariland Stukenbrock' AND name = 'Flying Tiger';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Unknown' AND h.park = 'Lightwater Valley' AND (c.id = h.id OR (c.name = 'Flying Tiger' AND c.park = 'Safariland Stukenbrock') OR (c.name = 'Vekoma Tsunami' AND c.park = 'South Sabahiya Park'))) OR
 (h.name = 'Spinning Racer' AND h.park = 'South Sabahiya Park' AND (c.id = h.id OR (c.name = 'Spinning Racer' AND c.park = 'Fantasy Island')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '168') FROM coasters h WHERE ((h.name = 'Unknown' AND h.park = 'Lightwater Valley') OR (h.name = 'Spinning Racer' AND h.park = 'South Sabahiya Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"168"%' AND json_extract(a.detail, '$.ride') = h.id);
