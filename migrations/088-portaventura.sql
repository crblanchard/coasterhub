-- 088: PortAventura Park, every coaster, from RCDB via Carter's screenshots,
-- 2026-10-31. All nine rows were bare.
--   Diablo - Tren de la Mina: Arrow Mine Train, 54.0 ft, 3,306 ft, 3:10, since
--     2 May 1995 (no speed on RCDB).
--   Dragon Khan: B&M Sitting, 148.0 ft, 65.0 mph, 4,165 ft, 8 inv, 1:45, since
--     2 May 1995. "B&M Sitting", the maker-first name, over "Sitting Coaster".
--   Furius Baco: Intamin Wing Rider (a new model name, maker-first), 83.9 mph
--     hydraulic launch, 2,788.8 ft, 1 inv, 0:55, since 5 Jun 2007 (no height).
--   Shambhala: B&M Hyper, 249.3 ft, 83.3 mph, 5,131.3 ft, 3:00, since 12 May 2012.
--   Stampida (Red) and (Blue): kept as two rows, the way the site lists every
--     racer (Carter: "make sure stampida are two separate entries"); RCDB gives
--     both tracks 84.0 ft, 46.0 mph, 3,127 ft, 1:40. CCI Wood, since 17 Mar 1997.
--   Tami-Tami: Vekoma Junior Coaster (207m), 27.9 ft, 21.7 mph, 679.1 ft, 0:44,
--     since Jul 1998.
--   Tomahawk: CCI Wood (family), 44.0 ft, 30.0 mph, 1,444 ft, 1:10, since
--     17 Mar 1997.
--   Uncharted: The Enigma of Penitence: Intamin Multi Dimension Coaster (as the
--     site already names one), enclosed, 39.4 ft, 2,296.6 ft, since 17 Jun 2023.
-- Each update is guarded on the row still having no length, so a second run is
-- a no-op; each gets the coaster_edited row /changes shows.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Diablo - Tren de la Mina' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Arrow Dynamics', model = 'Mine Train', h = 54.0, l = 3306.0, inv = 0, dur = 190, yr = 1995, opened = '1995-05-02', openedPrec = 'day' WHERE name = 'Diablo - Tren de la Mina' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Dragon Khan' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Bolliger & Mabillard', model = 'B&M Sitting', h = 148.0, s = 65.0, l = 4165.0, inv = 8, dur = 105, yr = 1995, opened = '1995-05-02', openedPrec = 'day' WHERE name = 'Dragon Khan' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Furius Baco' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin Wing Rider', s = 83.9, l = 2788.8, inv = 1, dur = 55, yr = 2007, opened = '2007-06-05', openedPrec = 'day' WHERE name = 'Furius Baco' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Shambhala' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Bolliger & Mabillard', model = 'B&M Hyper', h = 249.3, s = 83.3, l = 5131.3, inv = 0, dur = 180, yr = 2012, opened = '2012-05-12', openedPrec = 'day' WHERE name = 'Shambhala' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Stampida (Red)' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Custom Coasters International', model = 'CCI Wood', h = 84.0, s = 46.0, l = 3127.0, inv = 0, dur = 100, yr = 1997, opened = '1997-03-17', openedPrec = 'day' WHERE name = 'Stampida (Red)' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Stampida (Blue)' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Custom Coasters International', model = 'CCI Wood', h = 84.0, s = 46.0, l = 3127.0, inv = 0, dur = 100, yr = 1997, opened = '1997-03-17', openedPrec = 'day' WHERE name = 'Stampida (Blue)' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Tami-Tami' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Junior Coaster', h = 27.9, s = 21.7, l = 679.1, inv = 0, dur = 44, yr = 1998, opened = '1998-07-01', openedPrec = 'month' WHERE name = 'Tami-Tami' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Tomahawk' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Custom Coasters International', model = 'CCI Wood', h = 44.0, s = 30.0, l = 1444.0, inv = 0, dur = 70, yr = 1997, opened = '1997-03-17', openedPrec = 'day' WHERE name = 'Tomahawk' AND park = 'PortAventura Park' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '088') FROM coasters WHERE name = 'Uncharted: The Enigma of Penitence' AND park = 'PortAventura Park' AND l IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin Multi Dimension Coaster', h = 39.4, l = 2296.6, inv = 0, yr = 2023, opened = '2023-06-17', openedPrec = 'day' WHERE name = 'Uncharted: The Enigma of Penitence' AND park = 'PortAventura Park' AND l IS NULL;
