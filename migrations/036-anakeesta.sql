-- 036: Anakeesta, Gatlinburg, and its two mountain coasters (2026-10-17).
-- Carter sent its map card and the coordinates (35.71310528016848,
-- -83.51177056571905). Neither the park nor either ride was in D1.
--   Rail Runner  Brandauer (their "Braso" system), 2018, 640 m
--   Hellbender   Wiegand alpine coaster,           2022, 725 m
-- Lengths are stored in feet like every other row: 640 m = 2,100 ft,
-- 725 m = 2,379 ft. Models follow the site's maker-first naming ("Wiegand
-- Alpine" already has 12 rides). Safe to run twice.
INSERT INTO parks (name, lat, lon, region) SELECT 'Anakeesta', 35.71310528016848, -83.51177056571905, 'Tennessee, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Anakeesta');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Rail Runner', 'Anakeesta', 'Steel', 'Brandauer', 'Brandauer Alpine', 2100, 1, 2018, '2018', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Anakeesta') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Rail Runner' AND park = 'Anakeesta');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Hellbender', 'Anakeesta', 'Steel', 'Wiegand', 'Wiegand Alpine', 2379, 1, 2022, '2022', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Anakeesta') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Hellbender' AND park = 'Anakeesta');

-- Pigeon Forge Racing Coaster (Carter, same day: "Call these Racing Coaster
-- (Left) and Racing Coaster (Right)", 35.77297542241445, -83.53918509825631).
-- Wiegand, 2025, two tracks of 854 m = 2,802 ft each. The (Left)/(Right)
-- names are what /rankings reads as a racing pair, as with Matterhorn Bobsleds.
INSERT INTO parks (name, lat, lon, region) SELECT 'Pigeon Forge Racing Coaster', 35.77297542241445, -83.53918509825631, 'Tennessee, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Pigeon Forge Racing Coaster');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Racing Coaster (Left)', 'Pigeon Forge Racing Coaster', 'Steel', 'Wiegand', 'Wiegand Alpine', 2802, 1, 2025, '2025', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Pigeon Forge Racing Coaster') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Racing Coaster (Left)' AND park = 'Pigeon Forge Racing Coaster');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Racing Coaster (Right)', 'Pigeon Forge Racing Coaster', 'Steel', 'Wiegand', 'Wiegand Alpine', 2802, 1, 2025, '2025', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Pigeon Forge Racing Coaster') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Racing Coaster (Right)' AND park = 'Pigeon Forge Racing Coaster');
