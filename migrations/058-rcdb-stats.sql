-- 058: stats for four coasters from RCDB via Carter's screenshots, 2026-10-17.
-- All four had no maker or stats (three came in bare with 027's batch).
--   Barracuda Strike (SeaWorld San Antonio): B&M family invert, 90 ft, 44 mph,
--     1,800 ft, opened 7 Mar 2026. Same model name as Big Bad Wolf.
--   Texas Stingray (SeaWorld San Antonio): GCI wood (hybrid), 96 ft, 55 mph,
--     3,379 ft, opened 22 Feb 2020.
--   Beach Rescue Racer (SeaWorld San Antonio): Zierer Force, 1,300 ft, no
--     height or speed on RCDB, opened 8 Mar 2025.
--   Vortex (Kings Island): Arrow looper, 148 ft, 55 mph, 3,800 ft, 6
--     inversions, 2:30, opened 11 Apr 1987 (closing date set in 054).
-- Each: the Worker's coaster_edited activity row, then the update; both are
-- guarded on the row still having no length, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('type', 'manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '058') FROM coasters WHERE name = 'Barracuda Strike' AND park = 'SeaWorld San Antonio' AND l IS NULL;
UPDATE coasters SET type = 'Steel', manu = 'Bolliger & Mabillard', model = 'B&M Family Invert', h = 90, s = 44, l = 1800, inv = 0, yr = 2026, opened = '2026-03-07', openedPrec = 'day' WHERE name = 'Barracuda Strike' AND park = 'SeaWorld San Antonio' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('type', 'manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '058') FROM coasters WHERE name = 'Texas Stingray' AND park = 'SeaWorld San Antonio' AND l IS NULL;
UPDATE coasters SET type = 'Wood', manu = 'Great Coasters International', model = 'GCI Wood', h = 96, s = 55, l = 3379, inv = 0, yr = 2020, opened = '2020-02-22', openedPrec = 'day' WHERE name = 'Texas Stingray' AND park = 'SeaWorld San Antonio' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('type', 'manu', 'model', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '058') FROM coasters WHERE name = 'Beach Rescue Racer' AND park = 'SeaWorld San Antonio' AND l IS NULL;
UPDATE coasters SET type = 'Steel', manu = 'Zierer', model = 'Zierer Force', l = 1300, inv = 0, yr = 2025, opened = '2025-03-08', openedPrec = 'day' WHERE name = 'Beach Rescue Racer' AND park = 'SeaWorld San Antonio' AND l IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 11, json_object('id', id, 'fields', json_array('type', 'manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '058') FROM coasters WHERE name = 'Vortex' AND park = 'Kings Island' AND l IS NULL;
UPDATE coasters SET type = 'Steel', manu = 'Arrow Dynamics', model = 'Arrow Looper', h = 148, s = 55, l = 3800, inv = 6, dur = 150, yr = 1987, opened = '1987-04-11', openedPrec = 'day' WHERE name = 'Vortex' AND park = 'Kings Island' AND l IS NULL;
