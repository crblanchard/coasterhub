-- 083: Energylandia, plus Mission Ferrari and Rokan, from RCDB via Carter's
-- screenshots, 2026-10-29. Every Energylandia row was bare.
--   Abyssus: Vekoma Shockwave (1320m), 126.3 ft, 62.1 mph, 4,317.6 ft, 4 inv,
--     since 14 Jul 2021. A new model name, maker-first.
--   Boomerang: Vekoma Family Boomerang (208m Rebound), 75.5 ft, 37.3 mph,
--     672.6 ft, 1:36, since 29 Apr 2017. Already a Family Boomerang.
--   Choco Chip Creek: Vekoma Mine Train (custom), 54.1 ft, 34.2 mph,
--     3,937 ft, 3:30, since 27 Apr 2024.
--   Circus Coaster: SBF Visa powered kiddie coaster (Dragoon MX600/D), no
--     stats, since 17 Apr 2017.
--   Dragon Roller Coaster: Vekoma SFC (453m), 63.3 ft, 47.0 mph, 1,486.2 ft,
--     since 4 Jun 2015 -> Vekoma SFCs.
--   Draken: Preston & Barbieri family coaster (30 x 14 m), no stats, since
--     20 Jul 2019.
--   Formuła: Vekoma Space Warp (560m LSM), 81.4 ft, 49.2 mph, 1,837.3 ft,
--     3 inv, since 25 Jun 2016. A new model name.
--   Frida: Vekoma Junior Coaster (247m), 42.7 ft, 27.7 mph, 810.4 ft, since
--     20 Jul 2019.
--   Frutti Loop Coaster: SBF Visa Wacky Worm (Big Apple, MX48), since 2014
--     -> Wacky Worms.
--   Happy Loops: SBF Visa spinner (MX609 3 Loops), 23.0 ft, 18.6 mph,
--     370.8 ft, since 2017. Not put in SBF Visa Spinners: a different layout.
--   Honey Harbour: Vekoma family coaster (Kalypso, no model on the site),
--     38.4 ft, 28.6 mph, 833.3 ft, 0:56, since 27 Apr 2024.
--   Hyperion: Intamin Mega (custom), 252.6 ft, 88.2 mph, 4,757.2 ft, 1 inv,
--     since 14 Jul 2018.
--   Light Explorers: Vekoma Family Boomerang (238m Spirit), 79.4 ft,
--     37.3 mph, 780.8 ft, since 14 Jul 2021. Already a Family Boomerang.
--   Mars: SBF Visa Triangle Coaster (MX610, no model on the site), 19.7 ft,
--     393.7 ft, since 2014.
--   Roller Coaster Mayan: Vekoma SLC (689m standard), 109.3 ft, 49.7 mph,
--     2,260.5 ft, 5 inv, since 12 Sep 2015 -> Vekoma SLCs.
--   Speed: Intamin Water Coaster (custom), 164.0 ft, 62.8 mph, 2,253.9 ft,
--     since 2 Apr 2018. A new model name.
--   Viking Roller Coaster: SBF Visa spinning wild mouse (MX52, no model on
--     the site), 36.1 ft, 26.7 mph, 1,017.1 ft, 1:40, since 14 Jul 2014.
--   Zadra: already RMC Hybrid, 2019; 206.0 ft, 75.2 mph, 4,317.6 ft, 3 inv,
--     1:50, opened 22 Aug 2019.
--   Energuś: Vekoma Junior Coaster (335m), 42.7 ft, 28.5 mph, 1,099.1 ft,
--     since May 2015. That leaves no bare Energylandia row.
-- New:
--   Rokan (Energylandia): B&M Wing (custom), 203.4 ft, 71.5 mph, 3,986.2 ft,
--     3 inv, 2:21, opening 2027 — stored like the site's other 2027 rides.
--   Mission Ferrari (Ferrari World): Dynamic Attractions SFX Coaster, indoor,
--     44.7 mph, 1,777.7 ft, 2 inv, since 12 Jan 2023.
-- Each update is guarded on the row still being bare, so a second run is a
-- no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Abyssus' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET model = 'Vekoma Shockwave', h = 126.3, s = 62.1, l = 4317.6, inv = 4, yr = 2021, opened = '2021-07-14', openedPrec = 'day' WHERE name = 'Abyssus' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Boomerang' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', h = 75.5, s = 37.3, l = 672.6, inv = 0, dur = 96, yr = 2017, opened = '2017-04-29', openedPrec = 'day' WHERE name = 'Boomerang' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Choco Chip Creek' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Mine Train', h = 54.1, s = 34.2, l = 3937, inv = 0, dur = 210, yr = 2024, opened = '2024-04-27', openedPrec = 'day' WHERE name = 'Choco Chip Creek' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 6, json_object('id', id, 'fields', json_array('manu', 'model', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Circus Coaster' AND park = 'Energylandia' AND yr IS NULL;
UPDATE coasters SET manu = 'SBF Visa', model = 'Kiddie', inv = 0, yr = 2017, opened = '2017-04-17', openedPrec = 'day' WHERE name = 'Circus Coaster' AND park = 'Energylandia' AND yr IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Dragon Roller Coaster' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Suspended Family Coaster', h = 63.3, s = 47.0, l = 1486.2, inv = 0, yr = 2015, opened = '2015-06-04', openedPrec = 'day' WHERE name = 'Dragon Roller Coaster' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 5, json_object('id', id, 'fields', json_array('manu', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Draken' AND park = 'Energylandia' AND yr IS NULL;
UPDATE coasters SET manu = 'Preston & Barbieri', inv = 0, yr = 2019, opened = '2019-07-20', openedPrec = 'day' WHERE name = 'Draken' AND park = 'Energylandia' AND yr IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Formuła' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Space Warp', h = 81.4, s = 49.2, l = 1837.3, inv = 3, yr = 2016, opened = '2016-06-25', openedPrec = 'day' WHERE name = 'Formuła' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Frida' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET model = 'Vekoma Junior Coaster', h = 42.7, s = 27.7, l = 810.4, inv = 0, yr = 2019, opened = '2019-07-20', openedPrec = 'day' WHERE name = 'Frida' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 6, json_object('id', id, 'fields', json_array('manu', 'model', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Frutti Loop Coaster' AND park = 'Energylandia' AND yr IS NULL;
UPDATE coasters SET manu = 'SBF Visa', model = 'Wacky Worm', inv = 0, yr = 2014, opened = '2014', openedPrec = 'year' WHERE name = 'Frutti Loop Coaster' AND park = 'Energylandia' AND yr IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Happy Loops' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'SBF Visa', model = 'SBF Visa Spinner', h = 23.0, s = 18.6, l = 370.8, inv = 0, yr = 2017, opened = '2017', openedPrec = 'year' WHERE name = 'Happy Loops' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Honey Harbour' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', h = 38.4, s = 28.6, l = 833.3, inv = 0, dur = 56, yr = 2024, opened = '2024-04-27', openedPrec = 'day' WHERE name = 'Honey Harbour' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Hyperion' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin Mega', h = 252.6, s = 88.2, l = 4757.2, inv = 1, yr = 2018, opened = '2018-07-14', openedPrec = 'day' WHERE name = 'Hyperion' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Light Explorers' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', h = 79.4, s = 37.3, l = 780.8, inv = 0, yr = 2021, opened = '2021-07-14', openedPrec = 'day' WHERE name = 'Light Explorers' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 7, json_object('id', id, 'fields', json_array('manu', 'h', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Mars' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'SBF Visa', h = 19.7, l = 393.7, inv = 0, yr = 2014, opened = '2014', openedPrec = 'year' WHERE name = 'Mars' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Roller Coaster Mayan' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Suspended Looping Coaster', h = 109.3, s = 49.7, l = 2260.5, inv = 5, yr = 2015, opened = '2015-09-12', openedPrec = 'day' WHERE name = 'Roller Coaster Mayan' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Speed' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin Water Coaster', h = 164.0, s = 62.8, l = 2253.9, inv = 0, yr = 2018, opened = '2018-04-02', openedPrec = 'day' WHERE name = 'Speed' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Viking Roller Coaster' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'SBF Visa', h = 36.1, s = 26.7, l = 1017.1, inv = 0, dur = 100, yr = 2014, opened = '2014-07-14', openedPrec = 'day' WHERE name = 'Viking Roller Coaster' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 7, json_object('id', id, 'fields', json_array('h', 's', 'l', 'inv', 'dur', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Zadra' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET h = 206.0, s = 75.2, l = 4317.6, inv = 3, dur = 110, opened = '2019-08-22', openedPrec = 'day' WHERE name = 'Zadra' AND park = 'Energylandia' AND h IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 9, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '083') FROM coasters WHERE name = 'Energuś' AND park = 'Energylandia' AND h IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Junior Coaster', h = 42.7, s = 28.5, l = 1099.1, inv = 0, yr = 2015, opened = '2015-05-01', openedPrec = 'month' WHERE name = 'Energuś' AND park = 'Energylandia' AND h IS NULL;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Roller Coaster Mayan' AND c.park = 'Energylandia' AND g.name = 'Vekoma SLCs';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Frutti Loop Coaster' AND c.park = 'Energylandia' AND g.name = 'Wacky Worms';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Dragon Roller Coaster' AND c.park = 'Energylandia' AND g.name = 'Vekoma SFCs';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 0, 'via', '083') FROM clone_groups g WHERE g.name IN ('Vekoma SFCs', 'Wacky Worms', 'Vekoma SLCs') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"083"%');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Rokan', 'Energylandia', 'Steel', 'Bolliger & Mabillard', 'B&M Wing', 203.4, 71.5, 3986.2, 3, 141, 1, 2027, '2027', 'year', NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Rokan' AND park = 'Energylandia');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mission Ferrari', 'Ferrari World', 'Steel', 'Dynamic Attractions', 'Dynamic Attractions SFX Coaster', NULL, 44.7, 1777.7, 2, NULL, 1, 2023, '2023-01-12', 'day', NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mission Ferrari' AND park = 'Ferrari World');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE (c.name = 'Rokan' AND c.park = 'Energylandia' OR c.name = 'Mission Ferrari' AND c.park = 'Ferrari World') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
