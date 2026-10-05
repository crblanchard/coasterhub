-- 031: a "Zamperla Volares" category (2026-10-05). Carter: "Zamperla Volares
-- needs to be another category", then sent RCDB's Volare list (12 worldwide).
--
-- The six of those the site has, matched on name + park. Three already carry
-- the model; Trombi, Hero (Flamingo Land) and Super Flight (Playland) had none
-- and get it. The rest of RCDB's list (Genting, Kaeson, Skytropolis, the
-- Elitch Gardens original...) are parks or rides the site does not have.
-- Safe to run twice.
INSERT INTO clone_groups (name, note, created) SELECT 'Zamperla Volares', 'Zamperla Volare', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Zamperla Volares');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Time Warp' AND c.park = 'Canada''s Wonderland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Soarin'' Eagle' AND c.park = 'Luna Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Volare' AND c.park = 'Wiener Prater';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Trombi' AND c.park = 'Särkänniemi';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Hero' AND c.park = 'Flamingo Land';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Super Flight' AND c.park = 'Playland Park';
UPDATE coasters SET model = 'Zamperla Volare' WHERE name = 'Trombi' AND park = 'Särkänniemi' AND model IS NULL;
UPDATE coasters SET model = 'Zamperla Volare' WHERE name = 'Hero' AND park = 'Flamingo Land' AND model IS NULL;
UPDATE coasters SET model = 'Zamperla Volare' WHERE name = 'Super Flight' AND park = 'Playland Park' AND model IS NULL;
