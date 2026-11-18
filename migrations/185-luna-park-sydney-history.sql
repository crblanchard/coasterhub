-- 185: Luna Park (Sydney)'s older rides, from Carter's RCDB screenshots,
-- 2026-11-18. Most closed last century; Carter sent them, so they go in.
-- Safe to run twice.
--   Big Dipper (1935): the wooden one, 1935 to 1979-06 (came from Luna Park
--     Glenelg, not in the database: noted). The park now has three rides of
--     that name; the 1995 Arrow one is already "Big Dipper (Old)", so this one
--     takes its opening year.
--   Geronimo (Schwarzkopf Jet Star, 1982-1988) = Adventure World's Turbo
--     Mountain (1991-2009), linked, Turbo Mountain the home (latest stop).
--     Both into Schwarzkopf Jet Stars (Turbo Mountain was never added).
--   Jurassic Family Rollercoaster: a travelling coaster seen Dec 2011, gone by
--     Jan 2012; maker unknown.
--   Wild Mouse (Old): Girvan Bros wooden mouse, 1963-1970. RCDB lists the same
--     stops as the 1995 Wild Mouse (Luna Park, RAS Showground, Luna Park): one
--     ride, so linked, the running row the home.
--   Wild Cat (Schwarzkopf Wildcat, 1970 to 1979-06; the SBNO years after are
--     not recorded).
--   Sooper Jet (Wisdom Rides powered kiddie): RCDB has no dates, only "seen
--     circa 1983" on a 1980s ticket. Opened 1983 and closed 1988 (when the
--     park itself closed) are ESTIMATES so it reads as gone, not operating.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Big Dipper (1935)','Luna Park (Sydney)','Wood',NULL,NULL,NULL,NULL,NULL,0,NULL,1935,'1935','year','1979-06','month',1),
 ('Geronimo','Luna Park (Sydney)','Steel','Schwarzkopf','Schwarzkopf Jet Star',44.3,NULL,1919.3,0,NULL,1982,'1982','year','1988','year',1),
 ('Jurassic Family Rollercoaster','Luna Park (Sydney)','Steel',NULL,NULL,NULL,NULL,NULL,0,NULL,2011,'2011','year','2012-01','month',1),
 ('Wild Mouse (Old)','Luna Park (Sydney)','Wood','Girvan Bros',NULL,NULL,NULL,1312.3,0,61,1963,'1963','year','1970','year',1),
 ('Wild Cat','Luna Park (Sydney)','Steel','Schwarzkopf','Schwarzkopf Wildcat',NULL,NULL,NULL,0,NULL,1970,'1970','year','1979-06','month',1),
 ('Sooper Jet','Luna Park (Sydney)','Steel','Wisdom Rides',NULL,NULL,NULL,NULL,0,NULL,1983,'1983','year','1988','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park='Luna Park (Sydney)' AND c.name IN ('Big Dipper (1935)','Geronimo','Jurassic Family Rollercoaster','Wild Mouse (Old)','Wild Cat','Sooper Jet') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind='coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name='Schwarzkopf Jet Stars' AND ((c.name='Geronimo' AND c.park='Luna Park (Sydney)') OR (c.name='Turbo Mountain' AND c.park='Adventure World')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster=c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters h, coasters c WHERE
 (h.name='Turbo Mountain' AND h.park='Adventure World' AND (c.id=h.id OR (c.name='Geronimo' AND c.park='Luna Park (Sydney)'))) OR
 (h.name='Wild Mouse' AND h.park='Luna Park (Sydney)' AND (c.id=h.id OR (c.name='Wild Mouse (Old)' AND c.park='Luna Park (Sydney)')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '185') FROM coasters h WHERE ((h.name='Turbo Mountain' AND h.park='Adventure World') OR (h.name='Wild Mouse' AND h.park='Luna Park (Sydney)')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind='same_ride_set' AND a.detail LIKE '%"via":"185"%' AND json_extract(a.detail, '$.ride') = h.id);
