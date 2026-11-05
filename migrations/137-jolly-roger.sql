-- 137: Jolly Roger Amusement Park (Ocean City MD) and two relocation chains, from
-- Carter's RCDB screenshots, 2026-11-05. Pin is an ESTIMATE (missing-parks.md).
--   Barracuda (Zierer Flitzer, 2019-06-04) — the same ride as Jenkinson's
--     Flitzer (1992-2018) and La Ronde's La Course. La Course is added: RCDB has
--     it "<= 1972 to >= 1976", stored as 1972-1976 by year, the closest it says.
--   Orient Express (Wisdom, 2025) — the same ride as Palace Playland's Orient
--     Express (2000-2024, now marked removed) and Santa Cruz Beach Boardwalk's
--     (1998-1999, added).
-- The running copy at Jolly Roger is each set's home. Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Jolly Roger Amusement Park', 38.3790, -75.0740, 'Maryland, US', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Jolly Roger Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Barracuda','Jolly Roger Amusement Park','Steel','Zierer','Zierer Flitzer',NULL,NULL,NULL,0,NULL,2019,'2019-06-04','day',NULL,NULL,1),
 ('Orient Express','Jolly Roger Amusement Park','Steel','Wisdom Rides','Wisdom Orient Express',NULL,NULL,NULL,0,NULL,2025,'2025','year',NULL,NULL,1),
 ('La Course','La Ronde','Steel','Zierer','Zierer Flitzer',NULL,NULL,NULL,0,NULL,1972,'1972','year','1976-06-01','year',1),
 ('Orient Express','Santa Cruz Beach Boardwalk','Steel','Wisdom Rides','Wisdom Orient Express',NULL,NULL,NULL,0,NULL,1998,'1998','year','1999-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE ((c.park = 'Jolly Roger Amusement Park') OR (c.name = 'La Course' AND c.park = 'La Ronde') OR (c.name = 'Orient Express' AND c.park = 'Santa Cruz Beach Boardwalk')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 2, json_object('id', id, 'fields', json_array('yr', 'closed'), 'via', '137') FROM coasters WHERE name = 'Orient Express' AND park = 'Palace Playland' AND closed IS NULL;
UPDATE coasters SET yr = 2000, opened = '2000', openedPrec = 'year', closed = '2024-06-01', closedPrec = 'year' WHERE name = 'Orient Express' AND park = 'Palace Playland' AND closed IS NULL;
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE (h.name = 'Barracuda' AND h.park = 'Jolly Roger Amusement Park' AND (c.id = h.id OR (c.name = 'Flitzer' AND c.park = 'Jenkinson''s Boardwalk') OR (c.name = 'La Course' AND c.park = 'La Ronde'))) OR (h.name = 'Orient Express' AND h.park = 'Jolly Roger Amusement Park' AND (c.id = h.id OR (c.name = 'Orient Express' AND c.park IN ('Palace Playland', 'Santa Cruz Beach Boardwalk'))));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '137') FROM coasters h WHERE h.park = 'Jolly Roger Amusement Park' AND h.name IN ('Barracuda', 'Orient Express') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
-- Then three more Jolly Roger screenshots:
--   Wacky Worm (Fajume, "<= 2005", no date), put in the Wacky Worms category
--     like the other Fajume ones.
--   Wildcat (Schwarzkopf Wildcat 65m, 2015) — the Wildcat that opened Cedar
--     Point in 1970 (1970-05-23 to 1978), then Valleyfair's Rails, then Jolly
--     Roger twice (1999-2001, and since 2015). Cedar Point's 1970 one is added
--     as "Wildcat (Old)" — Carter's name, since Cedar Point had a second Wildcat
--     (1979-2011, not in the database). "(Old)" is never read as a racing side.
--     Valleyfair's Rails is not added: no dates in the screenshots.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Wacky Worm','Jolly Roger Amusement Park','Steel','Fajume','Wacky Worm',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,1),
 ('Wildcat','Jolly Roger Amusement Park','Steel','Schwarzkopf','Schwarzkopf Wildcat',NULL,NULL,NULL,0,NULL,2015,'2015','year',NULL,NULL,1),
 ('Wildcat (Old)','Cedar Point','Steel','Schwarzkopf','Schwarzkopf Wildcat',NULL,NULL,NULL,0,NULL,1970,'1970-05-23','day','1978-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE ((c.park = 'Jolly Roger Amusement Park' AND c.name IN ('Wacky Worm', 'Wildcat')) OR (c.name = 'Wildcat (Old)' AND c.park = 'Cedar Point')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Wacky Worm' AND c.park = 'Jolly Roger Amusement Park' AND g.name = 'Wacky Worms' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Wildcat' AND h.park = 'Jolly Roger Amusement Park' AND (c.id = h.id OR (c.name = 'Wildcat (Old)' AND c.park = 'Cedar Point'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '137') FROM coasters h WHERE h.park = 'Jolly Roger Amusement Park' AND h.name = 'Wildcat' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
-- And the rest of Jolly Roger's coasters closed this century (Carter: "that's
-- everything that closed this century, there are a lot of older rides" — the
-- older ones are left out):
--   Avalanche (Schwarzkopf Wildcat 54m, 2008-2014). Its earlier homes
--     (Palisades, Pirate's World, Bell's) are not in the database.
--   Racing (Zierer Flitzer, 2007 only).
--   Sea Serpent (Miler kiddie, 2015-2021; later Keller's Flea Market, not here)
--     and Sea Serpent (Old) (Miler kiddie, 2014 only; later Adventure Park USA's
--     Tumbleweed, not here) — "(Old)" per Carter, as with Cedar Point's Wildcat.
--   Wild Mouse (Maurer Wild Maus Classic, 2002-2006) — now Funtown Splashtown's
--     Wild Mouse, so that row gets the maker and stats it was missing and is the
--     set's home (where it runs).
--   The 1999-2001 Wildcat is the same unit as the 2015 one: one row, one credit.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Avalanche','Jolly Roger Amusement Park','Steel','Schwarzkopf','Schwarzkopf Wildcat',NULL,NULL,NULL,0,NULL,2008,'2008','year','2014-06-01','year',1),
 ('Racing','Jolly Roger Amusement Park','Steel','Zierer','Zierer Flitzer',NULL,NULL,NULL,0,NULL,2007,'2007','year','2007-09-01','year',1),
 ('Sea Serpent','Jolly Roger Amusement Park','Steel','Miler Manufacturing','Miler Kiddie',NULL,NULL,NULL,0,NULL,2015,'2015','year','2021-06-01','year',1),
 ('Sea Serpent (Old)','Jolly Roger Amusement Park','Steel','Miler Manufacturing','Miler Kiddie',NULL,NULL,NULL,0,NULL,2014,'2014','year','2014-09-01','year',1),
 ('Wild Mouse','Jolly Roger Amusement Park','Steel','Maurer Rides','Maurer Wild Mouse',49.3,28.0,1213.9,0,70,2002,'2002','year','2006-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Jolly Roger Amusement Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 7, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'dur', 'inv'), 'via', '137') FROM coasters WHERE name = 'Wild Mouse' AND park = 'Funtown Splashtown U.S.A.' AND manu IS NULL;
UPDATE coasters SET manu = 'Maurer Rides', model = 'Maurer Wild Mouse', h = 49.3, s = 28.0, l = 1213.9, dur = 70, inv = 0 WHERE name = 'Wild Mouse' AND park = 'Funtown Splashtown U.S.A.' AND manu IS NULL;
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'Wild Mouse' AND h.park = 'Funtown Splashtown U.S.A.' AND (c.id = h.id OR (c.name = 'Wild Mouse' AND c.park = 'Jolly Roger Amusement Park'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '137') FROM coasters h WHERE h.name = 'Wild Mouse' AND h.park = 'Funtown Splashtown U.S.A.' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
