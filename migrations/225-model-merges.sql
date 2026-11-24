-- 225: one name per model (Carter, 2026-11-24: "rename/merge models as much
-- as possible to make it consistent and group them properly"). Idempotent.
-- Kiddie coasters are one model, "Kiddie", whoever built them (the site
-- already had 68 that way); the maker-prefixed spellings fold into it.
UPDATE coasters SET model = 'Kiddie' WHERE model IN ('ART Kiddie', 'Chance Rides Kiddie', 'Gerstlauer Kiddie', 'Intamin Kiddie', 'Molina & Son''s Kiddie', 'Wisdom Rides Kiddie', 'Miler Kiddie');
-- Zamperla's Twister Coaster is the same product as "Zamperla Spinner" (same
-- 42.7 ft / 1,377.9 ft layout).
UPDATE coasters SET model = 'Zamperla Spinner' WHERE model = 'Zamperla Twister';
UPDATE coasters SET model = 'Zamperla Family Gravity Coaster' WHERE model = 'Zamperla Family Coaster';
UPDATE coasters SET model = 'Schwarzkopf Looping Star' WHERE model = 'Looping Star';
-- Gravitykraft is the Gravity Group's engineering arm.
UPDATE coasters SET model = 'Gravity Group Wood' WHERE model = 'Gravitykraft Wood';
UPDATE coasters SET model = 'SDC Hurricane' WHERE model = 'Hurricane' AND manu = 'SDC';
UPDATE coasters SET model = 'Interpark Zyklon' WHERE model = 'Pinfari Zyklon' AND manu = 'Interpark';
-- A generic model name on a maker that has its own spelling for it.
UPDATE coasters SET model = 'Gerstlauer Family Coaster' WHERE model = 'Family' AND manu = 'Gerstlauer';
UPDATE coasters SET model = 'Vekoma Family Coaster' WHERE model = 'Family' AND manu = 'Vekoma';
UPDATE coasters SET model = 'MACK Family' WHERE model = 'Family' AND manu = 'MACK Rides';
UPDATE coasters SET model = 'ART Family Coaster' WHERE model = 'Family' AND manu = 'ART Engineering';
UPDATE coasters SET model = 'Gerstlauer Family Launch' WHERE model = 'Family Launch' AND manu = 'Gerstlauer';
UPDATE coasters SET model = 'Arrow Mine Train' WHERE model = 'Mine Train' AND manu = 'Arrow Dynamics';
UPDATE coasters SET model = 'MACK Bobsled' WHERE model = 'Bobsled' AND manu = 'MACK Rides';
UPDATE coasters SET model = 'Intamin Indoor' WHERE model = 'Indoor' AND manu = 'Intamin';
UPDATE coasters SET model = 'Wiegand Alpine' WHERE model = 'Alpine' AND manu = 'Wiegand';
