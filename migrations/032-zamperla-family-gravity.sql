-- 032: a "Zamperla Family Gravity Coasters" category (2026-10-05). Carter:
-- "Make Zamperla family gravity coasters a category", then sent RCDB's list
-- (64 worldwide, model line "Family Coaster - Zamperla").
--
-- The 17 of those the site has, matched on name + park: nine already carried
-- the model, eight did not (most came in with 027/028 with none) and get it —
-- including Snoopy's Tenderpaw Twister Coaster, which was wrongly "Family
-- Launch". Safe to run twice.
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
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Snoopy''s Tenderpaw Twister Coaster' AND c.park = 'Knott''s Berry Farm';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Southern Express' AND c.park = 'Tropic Falls Theme Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Paw Patrol: Patrulla Canina' AND c.park = 'Parque de Atracciones de Madrid';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Family Flyer' AND c.park = 'Playland Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Runaway Mine Train' AND c.park = 'Flamingo Land';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Mine Train' AND c.park = 'Powerpark';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Pindsvinet' AND c.park = 'Fårup Sommerland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zamperla Family Gravity Coasters' AND c.name = 'Brazilian Buggies' AND c.park = 'Bellewaerde';
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Snoopy''s Tenderpaw Twister Coaster' AND park = 'Knott''s Berry Farm' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Southern Express' AND park = 'Tropic Falls Theme Park' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Paw Patrol: Patrulla Canina' AND park = 'Parque de Atracciones de Madrid' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Family Flyer' AND park = 'Playland Park' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Runaway Mine Train' AND park = 'Flamingo Land' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Mine Train' AND park = 'Powerpark' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Pindsvinet' AND park = 'Fårup Sommerland' AND (model IS NULL OR model = 'Family Launch');
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE name = 'Brazilian Buggies' AND park = 'Bellewaerde' AND (model IS NULL OR model = 'Family Launch');
