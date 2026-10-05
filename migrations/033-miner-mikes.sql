-- 033: a "Miner Mikes" category (2026-10-05). Carter: "Miner mikes too".
-- Wisdom's little family-entertainment-centre coaster. Checked against RCDB's
-- list (52 worldwide): five of them are on the site, matched on name + park.
-- Knucklehead's "Miner Mike" is NOT on RCDB's list, so it stays out. Boomers!
-- El Cajon's had no model or maker and gets both. Safe to run twice.
INSERT INTO clone_groups (name, note, created) SELECT 'Miner Mikes', 'Miner Mike', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Miner Mikes');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Miner Mikes' AND c.name = 'Miner Mike' AND c.park = 'Adventuredome';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Miner Mikes' AND c.name = 'Miners Mike' AND c.park = 'Boomers! (El Cajon)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Miner Mikes' AND c.name = 'Tiger Mike' AND c.park = 'Boomers! (Fountain Valley)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Miner Mikes' AND c.name = 'Incredible Express' AND c.park = 'John''s Incredible Pizza Company Roseville';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Miner Mikes' AND c.name = 'Miner Mike' AND c.park = 'Peter Piper Pizza';
UPDATE coasters SET model = 'Miner Mike', manu = COALESCE(manu, 'Wisdom Rides') WHERE name = 'Miners Mike' AND park = 'Boomers! (El Cajon)' AND model IS NULL;
