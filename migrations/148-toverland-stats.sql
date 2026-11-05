-- 148: Toverland stats from Carter's RCDB screenshots, 2026-11-05. Stat
-- fill-ins, so no /changes rows (Carter, same day). Only empty fields filled,
-- except one correction:
--   Toos-Express was a "Vekoma Roller Skater" in the Roller Skaters category.
--   RCDB has it as a custom Vekoma Junior Coaster, 1,049.9 ft — a Roller
--   Skater is 679 ft — so its model is corrected and it leaves that category.
--   Former names Achtbaan (2001-2003) and Boomerang (2004-2018) kept.
--   Booster Bike: Vekoma Motorbike 600m, 49.3 ft, 46.6 mph, 1,988.2 ft, 1:08,
--     2004-07-27. Fenix (RCDB "Fēnix"): 131.3 ft, 59 mph, 2,667.3 ft, 3 inv,
--     1:45, 2018-07-07. Troy: 104.5 ft, 54 mph, 3,534 ft, 1:50, 2007-06-29.
UPDATE coasters SET model = COALESCE(model, 'Vekoma Motorbike'), h = COALESCE(h, 49.3), s = COALESCE(s, 46.6), l = COALESCE(l, 1988.2), inv = COALESCE(inv, 0), dur = COALESCE(dur, 68), yr = COALESCE(yr, 2004), opened = COALESCE(opened, '2004-07-27'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Toverland' AND name = 'Booster Bike';
UPDATE coasters SET h = COALESCE(h, 131.3), s = COALESCE(s, 59.0), l = COALESCE(l, 2667.3), inv = COALESCE(inv, 3), dur = COALESCE(dur, 105), opened = COALESCE(opened, '2018-07-07'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Toverland' AND name = 'Fenix';
UPDATE coasters SET h = COALESCE(h, 104.5), s = COALESCE(s, 54.0), l = COALESCE(l, 3534.0), inv = COALESCE(inv, 0), dur = COALESCE(dur, 110), opened = COALESCE(opened, '2007-06-29'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Toverland' AND name = 'Troy';
UPDATE coasters SET model = 'Vekoma Junior Coaster', h = COALESCE(h, 39.3), s = COALESCE(s, 37.3), l = COALESCE(l, 1049.9), inv = COALESCE(inv, 0), dur = COALESCE(dur, 52), yr = COALESCE(yr, 2001), opened = COALESCE(opened, '2001-05-19'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Toverland' AND name = 'Toos-Express';
DELETE FROM clone_members WHERE coaster = (SELECT id FROM coasters WHERE park = 'Toverland' AND name = 'Toos-Express') AND group_id = (SELECT id FROM clone_groups WHERE name = 'Vekoma Roller Skaters');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.column1, 'rcdb', date('now') FROM coasters c, (VALUES ('Achtbaan'), ('Boomerang')) v WHERE c.park = 'Toverland' AND c.name = 'Toos-Express';
