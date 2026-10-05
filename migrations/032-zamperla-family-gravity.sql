-- 032: a "Zamperla Family Gravity Coasters" category (2026-10-05). Carter:
-- "Make Zamperla family gravity coasters a category". The nine the site has
-- with that model, matched on name + park. Safe to run twice.
INSERT INTO clone_groups (name, note, created) SELECT 'Zamperla Family Gravity Coasters', 'Zamperla Family Gravity Coaster', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Zamperla Family Gravity Coasters');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Whistle Punk Chaser' AND c.park = 'Dollywood';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Woodstock Express' AND c.park = 'Dorney Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Cocoa Cruiser' AND c.park = 'Hersheypark';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Howler' AND c.park = 'Holiday World';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Grand Exposition Coaster' AND c.park = 'Silver Dollar City';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Great Chase' AND c.park = 'Six Flags America';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Road Runner Express' AND c.park = 'Six Flags Discovery Kingdom';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Road Runner Railway' AND c.park = 'Six Flags Great Adventure';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Speedy Gonzales Hot Rod Racers' AND c.park = 'Six Flags Magic Mountain';
