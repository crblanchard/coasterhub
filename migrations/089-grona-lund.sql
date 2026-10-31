-- 089: Gröna Lund, from RCDB via Carter's screenshots, 2026-10-31. All eight
-- rows were bare (Monster had only its maker, model and year).
--   Insane: Intamin ZacSpin (32m), 108.3 ft, 34.2 mph, 810.4 ft, since 25 Apr 2009.
--   Jetline: Zierer (Schwarzkopf custom), 105.0 ft, 55.9 mph, 2,624.7 ft, 1:30,
--     23 Apr 1988 to 25 Jun 2023 (removed) — closed now.
--   Kvasten: Vekoma SFC (395m), 65.6 ft, 34.2 mph, 1,295.9 ft, 1:03, since 28 Apr 2007.
--   Monster: B&M Invert (already), 111.5 ft, 55.9 mph, 2,296.6 ft, 3 inv,
--     opened 2 Jun 2021 (was just "2021").
--   Nyckelpigan: Zierer Tivoli (small), 10.8 ft, 16.2 mph, 197.5 ft, since 1976.
--   Tuff-Tuff Tåget: Zamperla Mini Mouse, 8.0 ft, 4.5 mph, 262.5 ft, since 24 Apr 2010.
--   Twister: Gravitykraft wood (as the site names its other one), 51.0 ft,
--     38.0 mph, 1,544 ft, since 7 May 2011.
--   Vilda Musen: Gerstlauer Bobsled, 68.9 ft, 34.2 mph, 1,410.8 ft, 1:34,
--     opened 18 Apr 2003. RCDB now calls it Vildare Musen, standing but not
--     operating since 2026 while it is rebuilt "wilder" on Jetline's old
--     ground. Kept as Vilda Musen, the ride riders here rode, and not marked
--     closed: it is the same coaster coming back.
-- New:
--   Fenix: Gerstlauer Airtime Coaster (a new model name, maker-first), opening
--     2027, sharing Vildare Musen's structure — stored like the site's other
--     2027 rides.
--   Thriller: Schwarzkopf, 115.0 ft, 54.0 mph, 3,675 ft, 4 loops, at Gröna Lund
--     for 1996 only; later Texas Tornado (AstroWorld, 090), Zonga, Tsunami.
-- Guarded on no length / not already there, so a second run is a no-op.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Insane' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin ZacSpin', h = 108.3, s = 34.2, l = 810.4, inv = 0, yr = 2009, opened = '2009-04-25', openedPrec = 'day' WHERE name = 'Insane' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 11, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec', 'closed', 'closedPrec'), 'via', '089') FROM coasters WHERE name = 'Jetline' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Zierer', h = 105.0, s = 55.9, l = 2624.7, inv = 0, dur = 90, yr = 1988, opened = '1988-04-23', openedPrec = 'day', closed = '2023-06-25', closedPrec = 'day' WHERE name = 'Jetline' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Kvasten' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Suspended Family Coaster', h = 65.6, s = 34.2, l = 1295.9, inv = 0, dur = 63, yr = 2007, opened = '2007-04-28', openedPrec = 'day' WHERE name = 'Kvasten' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 6, json_object('id', id, 'fields', json_array('h', 's', 'l', 'inv', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Monster' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET h = 111.5, s = 55.9, l = 2296.6, inv = 3, opened = '2021-06-02', openedPrec = 'day' WHERE name = 'Monster' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Nyckelpigan' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Zierer', model = 'Zierer Tivoli', h = 10.8, s = 16.2, l = 197.5, inv = 0, yr = 1976, opened = '1976', openedPrec = 'year' WHERE name = 'Nyckelpigan' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Tuff-Tuff Tåget' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Zamperla', model = 'Zamperla Mini Mouse', h = 8.0, s = 4.5, l = 262.5, inv = 0, yr = 2010, opened = '2010-04-24', openedPrec = 'day' WHERE name = 'Tuff-Tuff Tåget' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('type', 'manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Twister' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET type = 'Wood', manu = 'Gravitykraft', model = 'Gravitykraft Wood', h = 51.0, s = 38.0, l = 1544.0, inv = 0, yr = 2011, opened = '2011-05-07', openedPrec = 'day' WHERE name = 'Twister' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '089') FROM coasters WHERE name = 'Vilda Musen' AND park = 'Gröna Lund' AND l IS NULL;
UPDATE coasters SET manu = 'Gerstlauer', model = 'Gerstlauer Bobsled', h = 68.9, s = 34.2, l = 1410.8, inv = 0, dur = 94, yr = 2003, opened = '2003-04-18', openedPrec = 'day' WHERE name = 'Vilda Musen' AND park = 'Gröna Lund' AND l IS NULL;
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Fenix', 'Gröna Lund', 'Steel', 'Gerstlauer', 'Gerstlauer Airtime', NULL, NULL, NULL, 0, NULL, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Fenix' AND park = 'Gröna Lund');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Fenix' AND c.park = 'Gröna Lund' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Thriller', 'Gröna Lund', 'Steel', 'Schwarzkopf', NULL, 115.0, 54.0, 3675.0, 4, NULL, 1996, '1996', 'year', '1996', 'year', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Thriller' AND park = 'Gröna Lund');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Thriller' AND c.park = 'Gröna Lund' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
