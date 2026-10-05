-- 029: a "Vekoma Family Boomerangs" category (2026-10-05). Carter: "Can we make
-- vekoma family boomerangs a category".
--
-- The same kind of family as 012's Vekoma Boomerangs: one layout at different
-- parks, so a ranking can collapse them. Found by reading the live table for
-- Family Boomerang models and the rides known to be one:
--   Raik (Phantasialand), Saven (Fårup Sommerland) — already "Vekoma Family Boomerang"
--   Velociraptor (Paultons Park) — model was "Family Boomerang"
--   Volldampf (Erlebnispark Tripsdrill) — no model; 028's sheet called it a Famerang
-- The two odd ones get the same model name so the family reads the same on
-- every page. More can be added in /edit like any category.
--
-- Matched on name + park; safe to run twice (the group by name, members by
-- clone_members' PRIMARY KEY, models only while still blank or the short form).
INSERT INTO clone_groups (name, note, created) SELECT 'Vekoma Family Boomerangs', 'Vekoma Family Boomerang', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Vekoma Family Boomerangs');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Raik' AND c.park = 'Phantasialand';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Saven' AND c.park = 'Fårup Sommerland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Velociraptor' AND c.park = 'Paultons Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Family Boomerangs' AND c.name = 'Volldampf' AND c.park = 'Erlebnispark Tripsdrill';
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Velociraptor' AND park = 'Paultons Park' AND (model IS NULL OR model = 'Family Boomerang');
UPDATE coasters SET model = 'Vekoma Family Boomerang' WHERE name = 'Volldampf' AND park = 'Erlebnispark Tripsdrill' AND model IS NULL;
