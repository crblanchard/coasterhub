-- 030: filling the official categories, and three new ones (2026-10-05).
-- Carter: "Yes please do your gaps. And do roller skaters and Dragon Wagons
-- (are orient express the same? Down to include them)".
--
-- Gaps: rides whose model already names a category but which were never put
-- in it — nearly all from 027/028's UK and European parks (22 Wacky Worms,
-- 13 Zierer Tivolis, 4 Vekoma Boomerangs, 4 SBF Visa Spinners, 2 Vekoma SFCs).
-- New: Vekoma Roller Skaters (12), Dragon Wagons (9), and Orient Expresses (9)
-- (named without "Wisdom", Carter, same day) as their OWN category — an Orient Express is Wisdom's bigger
-- figure-eight family coaster, not the little oval Dragon Wagon, so lumping
-- them would collapse two different rides. Members also get the category's
-- model name where theirs was blank or a short form ("Tivoli", "Kiddie").
--
-- Matched on name + park; safe to run twice (groups by name, members by
-- clone_members' PRIMARY KEY — a ride already in a group stays put).
-- If an earlier copy of this file already made them under the longer names:
UPDATE clone_groups SET name = 'Dragon Wagons' WHERE name = 'Wisdom Dragon Wagons' AND NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Dragon Wagons');
UPDATE clone_groups SET name = 'Orient Expresses' WHERE name = 'Wisdom Orient Expresses' AND NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Orient Expresses');
INSERT INTO clone_groups (name, note, created) SELECT 'Vekoma Roller Skaters', 'Vekoma Roller Skater', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Vekoma Roller Skaters');
INSERT INTO clone_groups (name, note, created) SELECT 'Dragon Wagons', 'Wisdom Dragon Wagon', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Dragon Wagons');
INSERT INTO clone_groups (name, note, created) SELECT 'Orient Expresses', 'Wisdom Orient Express', datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Orient Expresses');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Big Apple' AND c.park = 'Axels Nöjesfält (travelling)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Dragon Challenge' AND c.park = 'Barry Island Pleasure Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Willy der Wurm' AND c.park = 'Bauermeister (travelling)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Big Apple' AND c.park = 'Botton''s Pleasure Beach';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Caterpillar' AND c.park = 'Brean Theme Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Crazy Clown' AND c.park = 'Buwalda (travelling)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Santa''s Flying Sleigh' AND c.park = 'Buwalda (travelling)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Family Roller Coaster' AND c.park = 'Coney Beach Porthcawl';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Beehive Coaster' AND c.park = 'Dreamland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Happy Caterpillar' AND c.park = 'Dreamland';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Big Apple' AND c.park = 'Flamingo Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Wacky Worm' AND c.park = 'Funder Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Funlandasaurus' AND c.park = 'Funland Amusement Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Caterpillar' AND c.park = 'Funland at the Tropicana';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Big Apple' AND c.park = 'Great Yarmouth Pleasure Beach';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Caterpillar Coaster' AND c.park = 'Harbour Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Santa Express' AND c.park = 'Lakeside';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Little Dipper' AND c.park = 'Lightwater Valley';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Family Coaster' AND c.park = 'Manning (travelling)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Circus Clown' AND c.park = 'Oakwood';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'Big Apple' AND c.park = 'Ocean Beach Pleasure Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Wacky Worms' AND c.name = 'African Big Apple' AND c.park = 'West Midland Safari Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Mariehønen' AND c.park = 'Bakken';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Mariehønen' AND park = 'Bakken' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Keverbaan' AND c.park = 'Bellewaerde';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Keverbaan' AND park = 'Bellewaerde' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Viktor Vandorm' AND c.park = 'BonBon-Land';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Viktor Vandorm' AND park = 'BonBon-Land' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Ronde Des Rondins' AND c.park = 'Fraispertuis City';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Ronde Des Rondins' AND park = 'Fraispertuis City' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Ladybird' AND c.park = 'Lightwater Valley';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Ladybird' AND park = 'Lightwater Valley' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Treetops Coaster' AND c.park = 'Oakwood';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Treetops Coaster' AND park = 'Oakwood' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'SOS Numérobis' AND c.park = 'Parc Astérix';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'SOS Numérobis' AND park = 'Parc Astérix' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Egg-spress' AND c.park = 'Pleasurewood Hills';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Egg-spress' AND park = 'Pleasurewood Hills' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Vauhtimato' AND c.park = 'Särkänniemi';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Vauhtimato' AND park = 'Särkänniemi' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Rampage' AND c.park = 'The Big Sheep';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Rampage' AND park = 'The Big Sheep' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Kamelen' AND c.park = 'Tivoli Gardens';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Kamelen' AND park = 'Tivoli Gardens' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Dino Chase' AND c.park = 'Paultons Park';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Dino Chase' AND park = 'Paultons Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Zierer Tivolis' AND c.name = 'Cat-O-Pillar Coaster' AND c.park = 'Paultons Park';
UPDATE coasters SET model = 'Zierer Tivoli' WHERE name = 'Cat-O-Pillar Coaster' AND park = 'Paultons Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Boomerangs' AND c.name = 'Boomerang' AND c.park = 'Bellewaerde';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Boomerangs' AND c.name = 'Wipeout' AND c.park = 'Pleasurewood Hills';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Boomerangs' AND c.name = 'Cobra' AND c.park = 'Powerpark';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Boomerangs' AND c.name = 'Boomerang' AND c.park = 'Wiener Prater';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SBF Visa Spinners' AND c.name = 'Spinning Coaster' AND c.park = 'Frankie''s Fun Park (Greenville)';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SBF Visa Spinners' AND c.name = 'Drachenwirbel' AND c.park = 'Freizeitpark Plohn';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SBF Visa Spinners' AND c.name = 'Whirlwind' AND c.park = 'Great Yarmouth Pleasure Beach';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SBF Visa Spinners' AND c.name = 'Kids Spin' AND c.park = 'Skyline Park';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma SFCs' AND c.name = 'Orkanen' AND c.park = 'Fårup Sommerland';
UPDATE coasters SET model = 'Vekoma Suspended Family Coaster' WHERE name = 'Orkanen' AND park = 'Fårup Sommerland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma SFCs' AND c.name = 'Flight of the Pterosaur' AND c.park = 'Paultons Park';
UPDATE coasters SET model = 'Vekoma Suspended Family Coaster' WHERE name = 'Flight of the Pterosaur' AND park = 'Paultons Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Merlin''s Revenge' AND c.park = 'Castle Park';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Merlin''s Revenge' AND park = 'Castle Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Maximus' AND c.park = 'Crealy Theme Park';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Maximus' AND park = 'Crealy Theme Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Chip & Dale''s Gadget Coaster' AND c.park = 'Disneyland';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Chip & Dale''s Gadget Coaster' AND park = 'Disneyland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Mine Expressen' AND c.park = 'Fårup Sommerland';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Mine Expressen' AND park = 'Fårup Sommerland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Hollyhock and Roll' AND c.park = 'Kentucky Kingdom';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Hollyhock and Roll' AND park = 'Kentucky Kingdom' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Barnstormer' AND c.park = 'Magic Kingdom';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Barnstormer' AND park = 'Magic Kingdom' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Road Runner Express' AND c.park = 'Six Flags Magic Mountain';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Road Runner Express' AND park = 'Six Flags Magic Mountain' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Superman: Krypton Coaster' AND c.park = 'Six Flags Mexico';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Superman: Krypton Coaster' AND park = 'Six Flags Mexico' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Toos-Express' AND c.park = 'Toverland';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Toos-Express' AND park = 'Toverland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Western Expressen' AND c.park = 'Tusenfryd';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Western Expressen' AND park = 'Tusenfryd' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'Rhino Coaster' AND c.park = 'West Midland Safari Park';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'Rhino Coaster' AND park = 'West Midland Safari Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Vekoma Roller Skaters' AND c.name = 'K3 Roller Skater' AND c.park = 'Plopsaland Belgium';
UPDATE coasters SET model = 'Vekoma Roller Skater' WHERE name = 'K3 Roller Skater' AND park = 'Plopsaland Belgium' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon' AND c.park = 'Adventureland (New York)';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon' AND park = 'Adventureland (New York)' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon (Blue)' AND c.park = 'Butler Amusements';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon (Blue)' AND park = 'Butler Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon (Red)' AND c.park = 'Butler Amusements';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon (Red)' AND park = 'Butler Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Flying Dragon Wagon' AND c.park = 'Celebration City';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Flying Dragon Wagon' AND park = 'Celebration City' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Coaster' AND c.park = 'Clementon Park';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Coaster' AND park = 'Clementon Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon' AND c.park = 'Davis Amusement Cascadia';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon' AND park = 'Davis Amusement Cascadia' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon' AND c.park = 'Galaxyland';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon' AND park = 'Galaxyland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon' AND c.park = 'Helm & Sons Amusements';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon' AND park = 'Helm & Sons Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Dragon Wagons' AND c.name = 'Dragon Wagon' AND c.park = 'Sandy Lake Amusement Park';
UPDATE coasters SET model = 'Wisdom Dragon Wagon' WHERE name = 'Dragon Wagon' AND park = 'Sandy Lake Amusement Park' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Dragon' AND c.park = 'Beech Bend';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Dragon' AND park = 'Beech Bend' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express (1)' AND c.park = 'Butler Amusements';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express (1)' AND park = 'Butler Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express (2)' AND c.park = 'Butler Amusements';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express (2)' AND park = 'Butler Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express' AND c.park = 'Butler Amusements';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express' AND park = 'Butler Amusements' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express' AND c.park = 'Fun Time Shows';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express' AND park = 'Fun Time Shows' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express' AND c.park = 'Fun World';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express' AND park = 'Fun World' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express' AND c.park = 'Mascoutah Homecoming Festival';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express' AND park = 'Mascoutah Homecoming Festival' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Orient Express' AND c.park = 'Palace Playland';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Orient Express' AND park = 'Palace Playland' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Orient Expresses' AND c.name = 'Dragon Train' AND c.park = 'Sonoma TrainTown Railroad';
UPDATE coasters SET model = 'Wisdom Orient Express' WHERE name = 'Dragon Train' AND park = 'Sonoma TrainTown Railroad' AND (model IS NULL OR model IN ('Tivoli', 'Kiddie', 'Suspended Family Coaster'));
