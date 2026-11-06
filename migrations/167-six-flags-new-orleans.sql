-- 167: Six Flags New Orleans (closed by Hurricane Katrina, 2005-08-21), from
-- Carter's RCDB screenshots, 2026-11-06. Coordinates from Wikipedia. All
-- removed (the SBNO years after Katrina are not recorded).
--   Batman: The Ride (B&M Batman clone, 2003-04-12) = Fiesta Texas' Chupacabra,
--     linked (Chupacabra the home; the Thrill Valley stop is not here).
--   Jester (Vekoma Hurricane, 2003-04-13) = Fiesta Texas' Joker's Revenge
--     (1996-05-10 to 2001, added), linked, Jester the home.
--   Mega Zeph (CCI hybrid woodie, 2000-05-20). Muskrat Scrambler (L&T wild
--     mouse 30x20, 2000-05-20).
--   Road Runner's Express (Vekoma Junior 207m, 2000-05-20; "Rex's Rail Runner"
--     to 2002) = Magic Mountain's Road Runner Express, linked (Magic Mountain
--     the home).
--   Zydeco Scream (Boomerang, 2000-06-10) = Montjuïc's Boomerang, linked,
--     Zydeco Scream the home.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Six Flags New Orleans', 30.051111, -89.934417, 'Louisiana, US', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Six Flags New Orleans');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Batman: The Ride','Six Flags New Orleans','Steel','Bolliger & Mabillard','B&M Invert',105.0,50.0,2693.0,5,120,2003,'2003-04-12','day','2005-08-21','day',1),
 ('Jester','Six Flags New Orleans','Steel','Vekoma','Vekoma Hurricane',79.0,40.0,1935.7,3,NULL,2003,'2003-04-13','day','2005-08-21','day',1),
 ('Mega Zeph','Six Flags New Orleans','Wood','Custom Coasters International','CCI Wood',110.0,57.0,4000.0,0,NULL,2000,'2000-05-20','day','2005-08-21','day',1),
 ('Muskrat Scrambler','Six Flags New Orleans','Steel','L&T Systems','L&T Wild Mouse',47.6,25.0,1183.4,0,NULL,2000,'2000-05-20','day','2005-08-21','day',1),
 ('Road Runner''s Express','Six Flags New Orleans','Steel','Vekoma','Vekoma Junior Coaster',27.9,21.7,679.1,0,44,2000,'2000-05-20','day','2005-08-21','day',1),
 ('Zydeco Scream','Six Flags New Orleans','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2000,'2000-06-10','day','2005-08-21','day',1),
 ('Joker''s Revenge','Six Flags Fiesta Texas','Steel','Vekoma','Vekoma Hurricane',79.0,40.0,1935.7,3,NULL,1996,'1996-05-10','day','2001-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE (c.park = 'Six Flags New Orleans' OR (c.name = 'Joker''s Revenge' AND c.park = 'Six Flags Fiesta Texas')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Rex''s Rail Runner', 'rcdb', date('now') FROM coasters WHERE park = 'Six Flags New Orleans' AND name = 'Road Runner''s Express';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Six Flags New Orleans' AND ((c.name = 'Zydeco Scream' AND g.name = 'Vekoma Boomerangs') OR (c.name = 'Batman: The Ride' AND g.name = 'Batman clones')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
UPDATE same_ride SET ride = (SELECT id FROM coasters WHERE name = 'Zydeco Scream' AND park = 'Six Flags New Orleans') WHERE ride = (SELECT id FROM coasters WHERE name = 'Boomerang' AND park = 'Parque de Atracciones de Montjuïc');
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Chupacabra' AND h.park = 'Six Flags Fiesta Texas' AND (c.id = h.id OR (c.name = 'Batman: The Ride' AND c.park = 'Six Flags New Orleans'))) OR
 (h.name = 'Jester' AND h.park = 'Six Flags New Orleans' AND (c.id = h.id OR (c.name = 'Joker''s Revenge' AND c.park = 'Six Flags Fiesta Texas'))) OR
 (h.name = 'Road Runner Express' AND h.park = 'Six Flags Magic Mountain' AND (c.id = h.id OR (c.name = 'Road Runner''s Express' AND c.park = 'Six Flags New Orleans'))) OR
 (h.name = 'Zydeco Scream' AND h.park = 'Six Flags New Orleans' AND (c.id = h.id OR (c.name = 'Boomerang' AND c.park = 'Parque de Atracciones de Montjuïc')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '167') FROM coasters h WHERE ((h.name = 'Chupacabra' AND h.park = 'Six Flags Fiesta Texas') OR (h.name IN ('Jester', 'Zydeco Scream') AND h.park = 'Six Flags New Orleans') OR (h.name = 'Road Runner Express' AND h.park = 'Six Flags Magic Mountain')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"167"%' AND json_extract(a.detail, '$.ride') = h.id);
