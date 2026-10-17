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

-- Spinning Parrot at Island in Pigeon Forge (Carter, same day, from RCDB).
-- Both were already in D1, the ride with nothing filled in. RCDB: SBF Visa
-- spinner, operating since 7/10/2018, 0 inversions. It joins the SBF Visa
-- Spinners category (16 rides, all model 'SBF Visa Spinner'). The park moves
-- to the coordinates Carter gave; the old pin sat about 4 miles north.
UPDATE parks SET lat = 35.803008733276094, lon = -83.57047558631326 WHERE name = 'Island in Pigeon Forge';
UPDATE coasters SET manu = 'SBF Visa', model = 'SBF Visa Spinner', inv = 0, yr = 2018, opened = '2018-07-10', openedPrec = 'day' WHERE name = 'Spinning Parrot' AND park = 'Island in Pigeon Forge' AND manu IS NULL;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SBF Visa Spinners' AND c.name = 'Spinning Parrot' AND c.park = 'Island in Pigeon Forge';

-- Lost Mine Mountain Coaster & Mini-Golf, Pigeon Forge (Carter, same day;
-- 35.809053216528355, -83.5742475557486). Not in D1. Wiegand, 2023,
-- 1,646 m = 5,400 ft.
INSERT INTO parks (name, lat, lon, region) SELECT 'Lost Mine Mountain Coaster & Mini-Golf', 35.809053216528355, -83.5742475557486, 'Tennessee, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Lost Mine Mountain Coaster & Mini-Golf');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Lost Mine Mountain Coaster', 'Lost Mine Mountain Coaster & Mini-Golf', 'Steel', 'Wiegand', 'Wiegand Alpine', 5400, 1, 2023, '2023', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Lost Mine Mountain Coaster & Mini-Golf') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Lost Mine Mountain Coaster' AND park = 'Lost Mine Mountain Coaster & Mini-Golf');

-- Rowdy Bear's Funpark, Pigeon Forge (Carter, same day: "rename these two.
-- and rename the park", with RCDB's pages for both rides). The park was
-- "Rowdy Bear's Smoky Mountain Snowpark"; the old name stays as a park alias
-- so old links land. The site's two rides there, renamed to RCDB's names and
-- filled in:
--   Ski Lift Shootout Coaster   -> Rowdy's Sky Patrol    Wiegand Mystical Hex,
--       8/17/2019, 1,300 ft, 0 inv. Former names Alpine Flyer, Laser Gun
--       Coaster, Ski Lift Shootout Coaster.
--   Rowdy Bear Mountain Coaster -> Rowdy's Hot Rod Racers  Wiegand CoasterKart,
--       3/13/2021, 2,200 ft, 0 inv. Former names Power Coaster, Avalanche Snow
--       Coaster. ("Rowdy Bear Mountain Coaster" was only ever this site's
--       label, so it is not recorded as a former name.)
-- The former names are undated aliases: RCDB gives months and "?", and a
-- dated alias would print a made-up day.
UPDATE parks SET name = 'Rowdy Bear''s Funpark' WHERE name = 'Rowdy Bear''s Smoky Mountain Snowpark' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Rowdy Bear''s Funpark');
UPDATE coasters SET park = 'Rowdy Bear''s Funpark' WHERE park = 'Rowdy Bear''s Smoky Mountain Snowpark';
UPDATE park_aliases SET park = 'Rowdy Bear''s Funpark' WHERE park = 'Rowdy Bear''s Smoky Mountain Snowpark';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) VALUES ('Rowdy Bear''s Funpark', 'Rowdy Bear''s Smoky Mountain Snowpark', 'rename', date('now'));
UPDATE coasters SET name = 'Rowdy''s Sky Patrol', type = 'Steel', manu = 'Wiegand', model = 'Wiegand Mystical Hex', l = 1300, inv = 0, yr = 2019, opened = '2019-08-17', openedPrec = 'day' WHERE name = 'Ski Lift Shootout Coaster' AND park = 'Rowdy Bear''s Funpark';
UPDATE coasters SET name = 'Rowdy''s Hot Rod Racers', type = 'Steel', manu = 'Wiegand', model = 'Wiegand CoasterKart', l = 2200, inv = 0, yr = 2021, opened = '2021-03-13', openedPrec = 'day' WHERE name = 'Rowdy Bear Mountain Coaster' AND park = 'Rowdy Bear''s Funpark';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Ski Lift Shootout Coaster', 'rename', date('now') FROM coasters WHERE name = 'Rowdy''s Sky Patrol' AND park = 'Rowdy Bear''s Funpark';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Laser Gun Coaster', 'rename', date('now') FROM coasters WHERE name = 'Rowdy''s Sky Patrol' AND park = 'Rowdy Bear''s Funpark';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Alpine Flyer', 'rename', date('now') FROM coasters WHERE name = 'Rowdy''s Sky Patrol' AND park = 'Rowdy Bear''s Funpark';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Avalanche Snow Coaster', 'rename', date('now') FROM coasters WHERE name = 'Rowdy''s Hot Rod Racers' AND park = 'Rowdy Bear''s Funpark';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Power Coaster', 'rename', date('now') FROM coasters WHERE name = 'Rowdy''s Hot Rod Racers' AND park = 'Rowdy Bear''s Funpark';

-- SkyLand Ranch, Sevierville (Carter, same day; 35.83341390494683,
-- -83.57390870785191). Not in D1. Wild Stallion: Wiegand, 2022,
-- 2,000 m = 6,562 ft.
INSERT INTO parks (name, lat, lon, region) SELECT 'SkyLand Ranch', 35.83341390494683, -83.57390870785191, 'Tennessee, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'SkyLand Ranch');
INSERT INTO coasters (id, name, park, type, manu, model, l, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Wild Stallion', 'SkyLand Ranch', 'Steel', 'Wiegand', 'Wiegand Alpine', 6562, 1, 2022, '2022', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'SkyLand Ranch') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wild Stallion' AND park = 'SkyLand Ranch');

-- Wilderness at the Smokies, Sevierville (Carter, same day; 35.89421119536928,
-- -83.58437179829833). Not in D1. Rocky Top Glider (RCDB): Extreme Engineering
-- Cloud Coaster, indoor, suspended, since 10/2023, 1,312 ft, 25 ft, 0 inv.
INSERT INTO parks (name, lat, lon, region) SELECT 'Wilderness at the Smokies', 35.89421119536928, -83.58437179829833, 'Tennessee, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Wilderness at the Smokies');
INSERT INTO coasters (id, name, park, type, manu, model, h, l, inv, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Rocky Top Glider', 'Wilderness at the Smokies', 'Steel', 'Extreme Engineering', 'Extreme Engineering Cloud Coaster', 25, 1312, 0, 1, 2023, '2023-10', 'month', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Wilderness at the Smokies') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Rocky Top Glider' AND park = 'Wilderness at the Smokies');
