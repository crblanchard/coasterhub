-- 149: the rest of Freizeit-Land Geiselwind, from Carter's RCDB screenshots,
-- 2026-11-05 (its MACK Wilde Maus, 2011, came in with 147).
-- Same names at different times get a suffix, as with Wildcat (Old):
--   Cobra (Interpark Wild Wind, since 2018-03-24) and Cobra (Old) (the same
--     unit's 2015 run, 2015-05-01 to 2015-09-13) — linked, one credit.
--   Wilde Maus (2012): Maurer Wild Maus Classic, 2012-04-06 to 2013-09-11 —
--     a different machine from 147's MACK one, so not linked.
--   Black Hole (Zierer Hell Diver, 2014-04-12 to 2014-09-14) is the same ride
--     as Drachen Höhle (since 2019-04-13) — linked. Its Movie Park Germany run
--     has no dates in the screenshots, so it is not added.
-- Also: Doggy Dog (SBF Visa MX48, 2017-04-08), Fluch des Kraken (Vekoma
-- Boomerang, 2000; "Boomerang" to 2021; into Vekoma Boomerangs), Piraten Spinner
-- (Zierer spinner, 1994; "Drehgondelbahn" to 2018), Silverpony Express (MACK
-- powered, 1989; "Blauer Enzian" to 2022), Taka Waka (SBF Cyclon MX49,
-- 2022-04-10; its Kneippbyn run is not here), Wilde Hilde (RES Roller Ball,
-- 2026-08-02) = Schwaben Park's Wilde Hilde, linked (Schwaben Park's row is
-- left open: no closing date in the screenshots), and Marienkäferbahn (Zierer
-- Tivoli Large, 1989-2008; into Zierer Tivolis; its Movie Park run not here).
-- Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Cobra','Freizeit-Land Geiselwind','Steel','Interpark','Interpark Wild Wind',33.0,NULL,656.2,1,60,2018,'2018-03-24','day',NULL,NULL,1),
 ('Cobra (Old)','Freizeit-Land Geiselwind','Steel','Interpark','Interpark Wild Wind',33.0,NULL,656.2,1,60,2015,'2015-05-01','day','2015-09-13','day',1),
 ('Doggy Dog','Freizeit-Land Geiselwind','Steel','SBF Visa','SBF Visa Family Coaster',NULL,NULL,NULL,0,NULL,2017,'2017-04-08','day',NULL,NULL,1),
 ('Drachen Höhle','Freizeit-Land Geiselwind','Steel','Zierer','Zierer Hell Diver',22.7,25.5,1259.8,0,75,2019,'2019-04-13','day',NULL,NULL,1),
 ('Black Hole','Freizeit-Land Geiselwind','Steel','Zierer','Zierer Hell Diver',22.7,25.5,1259.8,0,75,2014,'2014-04-12','day','2014-09-14','day',1),
 ('Fluch des Kraken','Freizeit-Land Geiselwind','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,2000,'2000','year',NULL,NULL,1),
 ('Piraten Spinner','Freizeit-Land Geiselwind','Steel','Zierer','Zierer Spinner',NULL,18.6,328.1,0,NULL,1994,'1994','year',NULL,NULL,1),
 ('Silverpony Express','Freizeit-Land Geiselwind','Steel','MACK Rides','MACK Powered Coaster',NULL,22.4,767.8,0,NULL,1989,'1989','year',NULL,NULL,1),
 ('Taka Waka','Freizeit-Land Geiselwind','Steel','SBF Visa',NULL,32.8,NULL,1099.1,0,NULL,2022,'2022-04-10','day',NULL,NULL,1),
 ('Wilde Hilde','Freizeit-Land Geiselwind','Steel','RES Rides','RES Roller Ball',68.9,NULL,288.7,0,90,2026,'2026-08-02','day',NULL,NULL,1),
 ('Marienkäferbahn','Freizeit-Land Geiselwind','Steel','Zierer','Zierer Tivoli',26.3,22.4,1181.1,0,NULL,1989,'1989','year','2008-06-01','year',1),
 ('Wilde Maus (2012)','Freizeit-Land Geiselwind','Steel','Maurer Rides','Maurer Wild Mouse',49.2,31.1,1197.5,0,NULL,2012,'2012-04-06','day','2013-09-11','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Freizeit-Land Geiselwind' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.column2, 'rcdb', date('now') FROM coasters c JOIN (VALUES ('Fluch des Kraken','Boomerang'),('Piraten Spinner','Drehgondelbahn'),('Silverpony Express','Blauer Enzian')) v ON v.column1 = c.name WHERE c.park = 'Freizeit-Land Geiselwind';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Freizeit-Land Geiselwind' AND ((c.name = 'Fluch des Kraken' AND g.name = 'Vekoma Boomerangs') OR (c.name = 'Marienkäferbahn' AND g.name = 'Zierer Tivolis')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.park = 'Freizeit-Land Geiselwind' AND (
 (h.name = 'Cobra' AND (c.id = h.id OR (c.name = 'Cobra (Old)' AND c.park = 'Freizeit-Land Geiselwind'))) OR
 (h.name = 'Drachen Höhle' AND (c.id = h.id OR (c.name = 'Black Hole' AND c.park = 'Freizeit-Land Geiselwind'))) OR
 (h.name = 'Wilde Hilde' AND (c.id = h.id OR (c.name = 'Wilde Hilde' AND c.park = 'Schwaben Park'))));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '149') FROM coasters h WHERE h.park = 'Freizeit-Land Geiselwind' AND h.name IN ('Cobra', 'Drachen Höhle', 'Wilde Hilde') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
-- Then Schwaben Park, from Carter's screenshots. Stat fill-ins (no /changes):
-- Wilde Hilde (RES Roller Ball S, 2018-10-13 to 2025-11-02 — now closed here,
-- its Geiselwind run is the home), Force One (Zierer ESC 535, 72.2 ft, 40.4 mph,
-- 1,738.8 ft, 0:38, 2010-05-18), Hummel Brummel (Wiegand Wie-Flyer, 1,640.4 ft,
-- 2020-08-15), Raupen Express (Zierer Force Zero, 13.1 ft, 14.9 mph, 229.7 ft,
-- 2003; "Crazy Worm" to 2017). New: Himalayabahn (Schwarzkopf Wildcat 54m,
-- 1989-2015); its later home, Safariland Stukenbrock (as Alpen Coaster), is not here.
UPDATE coasters SET model = COALESCE(model, 'RES Roller Ball'), h = COALESCE(h, 68.9), l = COALESCE(l, 288.7), inv = COALESCE(inv, 0), dur = COALESCE(dur, 90), yr = COALESCE(yr, 2018), opened = COALESCE(opened, '2018-10-13'), openedPrec = COALESCE(openedPrec, 'day'), closed = COALESCE(closed, '2025-11-02'), closedPrec = COALESCE(closedPrec, 'day') WHERE park = 'Schwaben Park' AND name = 'Wilde Hilde';
UPDATE coasters SET model = COALESCE(model, 'Zierer Force'), h = COALESCE(h, 72.2), s = COALESCE(s, 40.4), l = COALESCE(l, 1738.8), inv = COALESCE(inv, 0), dur = COALESCE(dur, 38), yr = COALESCE(yr, 2010), opened = COALESCE(opened, '2010-05-18'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Schwaben Park' AND name = 'Force One';
UPDATE coasters SET model = COALESCE(model, 'Wiegand Wie-Flyer'), l = COALESCE(l, 1640.4), inv = COALESCE(inv, 0), yr = COALESCE(yr, 2020), opened = COALESCE(opened, '2020-08-15'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Schwaben Park' AND name = 'Hummel Brummel';
UPDATE coasters SET h = COALESCE(h, 13.1), s = COALESCE(s, 14.9), l = COALESCE(l, 229.7), inv = COALESCE(inv, 0), yr = COALESCE(yr, 2003), opened = COALESCE(opened, '2003'), openedPrec = COALESCE(openedPrec, 'year') WHERE park = 'Schwaben Park' AND name = 'Raupen Express';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Crazy Worm', 'rcdb', date('now') FROM coasters WHERE park = 'Schwaben Park' AND name = 'Raupen Express';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Himalayabahn', 'Schwaben Park', 'Steel', 'Schwarzkopf', 'Schwarzkopf Wildcat', 44.3, NULL, 1509.2, 0, NULL, 1989, '1989', 'year', '2015-06-01', 'year', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Himalayabahn' AND park = 'Schwaben Park');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Himalayabahn' AND c.park = 'Schwaben Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
