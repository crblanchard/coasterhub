-- 216: categories catch up with the coasters added since they were filled
-- (Carter, 2026-11-22: "auto update categories too to include all the new
-- coasters we've added"). A category here IS a model: every coaster carrying
-- the model joins its category, unless it was set aside (category_skipped)
-- or already sits in another one (clone_members.coaster is the primary key,
-- so INSERT OR IGNORE leaves those alone). Batman clones and the Superman
-- flyers are hand-picked B&M Inverts/Flyers, not a whole model, so they are
-- not in the list. Re-run this after any batch of new coasters: it only ever
-- adds what is missing. 67 coasters on its first run.
-- One clone_set row per category that grew, with how many joined, written
-- BEFORE the insert so it can count them (and writes nothing on a re-run).
INSERT INTO activity (at, actor, kind, subject, n, detail)
SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, COUNT(*), json_object('made', 0, 'via', '216')
FROM (VALUES
  ('Dragon Wagons','Wisdom Dragon Wagon'),('Go Gators','Wisdom Go Gator'),('Miner Mikes','Miner Mike'),
  ('Orient Expresses','Wisdom Orient Express'),('RES Roller Balls','RES Roller Ball'),('S&S FreeSpins','S&S FreeSpin'),
  ('SBF Visa Spinners','SBF Visa Spinner'),('SDC Galaxis','SDC Galaxi'),('Schwarzkopf Jet Stars','Schwarzkopf Jet Star'),
  ('Sky Rocket IIs','Premier Sky Rocket II'),('Vekoma Boomerangs','Vekoma Boomerang'),
  ('Vekoma Family Boomerangs','Vekoma Family Boomerang'),('Vekoma Roller Skaters','Vekoma Roller Skater'),
  ('Vekoma SFCs','Vekoma Suspended Family Coaster'),('Vekoma SLCs','Vekoma Suspended Looping Coaster'),
  ('Wacky Worms','Wacky Worm'),('Zamperla Family Gravity Coasters','Zamperla Family Gravity Coaster'),
  ('Zamperla Volares','Zamperla Volare'),('Zierer Tivolis','Zierer Tivoli')) r
JOIN clone_groups g ON g.name = r.column1
JOIN coasters c ON c.model = r.column2
WHERE NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id)
  AND NOT EXISTS (SELECT 1 FROM category_skipped k WHERE k.coaster = c.id)
GROUP BY g.name;
INSERT OR IGNORE INTO clone_members (coaster, group_id)
SELECT c.id, g.id FROM (VALUES
  ('Dragon Wagons','Wisdom Dragon Wagon'),('Go Gators','Wisdom Go Gator'),('Miner Mikes','Miner Mike'),
  ('Orient Expresses','Wisdom Orient Express'),('RES Roller Balls','RES Roller Ball'),('S&S FreeSpins','S&S FreeSpin'),
  ('SBF Visa Spinners','SBF Visa Spinner'),('SDC Galaxis','SDC Galaxi'),('Schwarzkopf Jet Stars','Schwarzkopf Jet Star'),
  ('Sky Rocket IIs','Premier Sky Rocket II'),('Vekoma Boomerangs','Vekoma Boomerang'),
  ('Vekoma Family Boomerangs','Vekoma Family Boomerang'),('Vekoma Roller Skaters','Vekoma Roller Skater'),
  ('Vekoma SFCs','Vekoma Suspended Family Coaster'),('Vekoma SLCs','Vekoma Suspended Looping Coaster'),
  ('Wacky Worms','Wacky Worm'),('Zamperla Family Gravity Coasters','Zamperla Family Gravity Coaster'),
  ('Zamperla Volares','Zamperla Volare'),('Zierer Tivolis','Zierer Tivoli')) r
JOIN clone_groups g ON g.name = r.column1
JOIN coasters c ON c.model = r.column2
WHERE NOT EXISTS (SELECT 1 FROM category_skipped k WHERE k.coaster = c.id);
