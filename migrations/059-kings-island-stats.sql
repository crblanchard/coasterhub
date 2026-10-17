-- 059: Kings Island's four bare rows, from RCDB via Carter's screenshots,
-- 2026-10-17.
--   Great Pumpkin Coaster: E&F Miler kiddie (same model name as Kings
--     Dominion's), 8 ft, 199.3 ft, 0:52, since 1992. Former names Little
--     Bill's Giggle Coaster (2006-09), Top Cat's Taxi Jam (1998-2005), Scooby
--     Zoom (1992-97) go in as aliases so old logs and imports still match.
--   Scooby's Ghoster Coaster: Caripro Batflyer, 35 ft, 8 mph, 0:50, operated
--     1998-2005 — it was showing as OPERATING. (Its storage years are not
--     recorded, like SBNO.)
--   Snoopy's Soap Box Racers: Vekoma Family Boomerang, 75.5 ft, 37.3 mph,
--     672.6 ft, 1:36, opened 24 May 2024.
--   Son Of Beast: wood, 218 ft, 78.4 mph, 7,032 ft, 2:20, operated
--     26 May 2000 to June 2009 (the row said 2009-01-01). RCDB names no
--     maker (Gerstlauer only built the trains), so manu stays empty.
-- Each: the Worker's coaster_edited activity row, then the update, guarded on
-- the row still having no duration, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '059') FROM coasters WHERE name = 'Great Pumpkin Coaster' AND park = 'Kings Island' AND dur IS NULL;
UPDATE coasters SET manu = 'E&F Miler', model = 'Miler Kiddie', h = 8, l = 199.3, inv = 0, dur = 52, yr = 1992, opened = '1992', openedPrec = 'year' WHERE name = 'Great Pumpkin Coaster' AND park = 'Kings Island' AND dur IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 11, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'inv', 'dur', 'yr', 'opened', 'openedPrec', 'closed', 'closedPrec'), 'via', '059') FROM coasters WHERE name = 'Scooby''s Ghoster Coaster' AND park = 'Kings Island' AND dur IS NULL;
UPDATE coasters SET manu = 'Caripro', model = 'Caripro Batflyer', h = 35, s = 8, inv = 0, dur = 50, yr = 1998, opened = '1998', openedPrec = 'year', closed = '2005', closedPrec = 'year' WHERE name = 'Scooby''s Ghoster Coaster' AND park = 'Kings Island' AND dur IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '059') FROM coasters WHERE name = 'Snoopy''s Soap Box Racers' AND park = 'Kings Island' AND dur IS NULL;
UPDATE coasters SET manu = 'Vekoma', h = 75.5, s = 37.3, l = 672.6, inv = 0, dur = 96, yr = 2024, opened = '2024-05-24', openedPrec = 'day' WHERE name = 'Snoopy''s Soap Box Racers' AND park = 'Kings Island' AND dur IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 11, json_object('id', id, 'fields', json_array('type', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec', 'closed', 'closedPrec'), 'via', '059') FROM coasters WHERE name = 'Son Of Beast' AND park = 'Kings Island' AND dur IS NULL;
UPDATE coasters SET type = 'Wood', h = 218, s = 78.4, l = 7032, inv = 0, dur = 140, yr = 2000, opened = '2000-05-26', openedPrec = 'day', closed = '2009-06', closedPrec = 'month' WHERE name = 'Son Of Beast' AND park = 'Kings Island' AND dur IS NULL;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Little Bill''s Giggle Coaster', 'rcdb', date('now') FROM coasters WHERE name = 'Great Pumpkin Coaster' AND park = 'Kings Island';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Top Cat''s Taxi Jam', 'rcdb', date('now') FROM coasters WHERE name = 'Great Pumpkin Coaster' AND park = 'Kings Island';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Scooby Zoom', 'rcdb', date('now') FROM coasters WHERE name = 'Great Pumpkin Coaster' AND park = 'Kings Island';
