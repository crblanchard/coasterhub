-- 031: a "Zamperla Volares" category (2026-10-05). Carter: "Zamperla Volares
-- needs to be another category".
--
-- The flying-in-a-cage Volare: the same ride wherever it stands. Three already
-- carry the model; Trombi (Särkänniemi) came in with 027 as a Zamperla
-- "Flying" coaster and is the park's Volare, so it gets the model name too.
-- Matched on name + park; safe to run twice.
INSERT INTO clone_groups (name, note, created) SELECT 'Zamperla Volares', 'Zamperla Volare', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Zamperla Volares');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Time Warp' AND c.park = 'Canada''s Wonderland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Soarin'' Eagle' AND c.park = 'Luna Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Volare' AND c.park = 'Wiener Prater';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Volares' AND c.name = 'Trombi' AND c.park = 'Särkänniemi';
UPDATE coasters SET model = 'Zamperla Volare' WHERE name = 'Trombi' AND park = 'Särkänniemi' AND model IS NULL;
