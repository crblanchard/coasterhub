-- 145: Magic Kingdom's TRON Lightcycle Run and Seven Dwarfs Mine Train had no
-- details (original import). From Carter's RCDB screenshots, 2026-11-05:
--   TRON: Vekoma family coaster (TRON), LSM launch, 78.1 ft, 59.3 mph,
--     3,169.3 ft, 0 inversions, 2023-04-04. Kept our name, not RCDB's "TRON
--     Lightcycle / Run" styling.
--   Seven Dwarfs: Vekoma family coaster, 41 ft drop (stored as height, RCDB
--     gives no height), 34 mph, 2,001.3 ft, 0 inversions, 2014-05-28.
-- Logged first; only fills empty rows. Safe to run twice.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 7, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr'), 'via', '145') FROM coasters WHERE park = 'Magic Kingdom' AND name IN ('TRON Lightcycle Run', 'Seven Dwarfs Mine Train') AND manu IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Family Coaster', h = 78.1, s = 59.3, l = 3169.3, inv = 0, yr = 2023, opened = '2023-04-04', openedPrec = 'day' WHERE park = 'Magic Kingdom' AND name = 'TRON Lightcycle Run' AND manu IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Family Coaster', h = 41.0, s = 34.0, l = 2001.3, inv = 0, yr = 2014, opened = '2014-05-28', openedPrec = 'day' WHERE park = 'Magic Kingdom' AND name = 'Seven Dwarfs Mine Train' AND manu IS NULL;
