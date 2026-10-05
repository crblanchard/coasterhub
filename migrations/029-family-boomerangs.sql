-- 029: a "Vekoma Family Boomerangs" category (2026-10-05). Carter: "Can we make
-- vekoma family boomerangs a category", then sent RCDB's list of every Vekoma
-- Family Boomerang (44 worldwide) to check against.
--
-- The same kind of family as 012's Vekoma Boomerangs: one layout at different
-- parks, so a ranking can collapse them. These 13 are the RCDB list's rides we
-- have, matched on name + park. Each also gets the model "Vekoma Family
-- Boomerang" so the family reads the same on every page — including
-- Parc des Combes' Boomerang, which 027 wrongly called a full Vekoma Boomerang.
-- The rest of RCDB's list (Kansas Twister, Speedway Stunt Coaster, the Chinese
-- and Vietnamese parks...) are parks or rides the site does not have yet.
--
-- Safe to run twice: the group by name, members by clone_members' PRIMARY KEY,
-- and a member already in another group is left where it is.
INSERT INTO clone_groups (name, note, created) SELECT 'Vekoma Family Boomerangs', 'Vekoma Family Boomerang', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Vekoma Family Boomerangs');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Raik' AND c.park = 'Phantasialand';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Saven' AND c.park = 'Fårup Sommerland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Velociraptor' AND c.park = 'Paultons Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Volldampf' AND c.park = 'Erlebnispark Tripsdrill';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Accelerator' AND c.park = 'Drayton Manor';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Boomerang' AND c.park = 'Energylandia';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Boomerang' AND c.park = 'Parc des Combes';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Good Gravy!' AND c.park = 'Holiday World';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Snoopy''s Soap Box Racers' AND c.park = 'Kings Island';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'The Quest' AND c.park = 'Emerald Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Light Explorers' AND c.park = 'Energylandia';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Luna' AND c.park = 'Liseberg';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Fireline Redwood' AND c.park = 'Fraispertuis City';
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Raik' AND park = 'Phantasialand' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Saven' AND park = 'Fårup Sommerland' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Velociraptor' AND park = 'Paultons Park' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Volldampf' AND park = 'Erlebnispark Tripsdrill' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Accelerator' AND park = 'Drayton Manor' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Boomerang' AND park = 'Energylandia' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Boomerang' AND park = 'Parc des Combes' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Good Gravy!' AND park = 'Holiday World' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Snoopy''s Soap Box Racers' AND park = 'Kings Island' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'The Quest' AND park = 'Emerald Park' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Light Explorers' AND park = 'Energylandia' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Luna' AND park = 'Liseberg' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Fireline Redwood' AND park = 'Fraispertuis City' AND (model IS NULL OR model IN ('Family Boomerang', 'Vekoma Boomerang'));
