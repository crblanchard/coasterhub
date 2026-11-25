-- American Eagle (Red)/(Blue) were model "Racer" and El Toro "Wood"; all three
-- are Intamin wooden coasters, so "Intamin Wood" like Balder and Colossos
-- (Carter, 2026-11-26: "trying to reduce categories as much as possible").
-- No activity row: a model fill on an existing coaster. Idempotent.
UPDATE coasters SET model = 'Intamin Wood' WHERE manu = 'Intamin' AND ((park = 'Six Flags Great America' AND name IN ('American Eagle (Red)', 'American Eagle (Blue)')) OR (park = 'Six Flags Great Adventure' AND name = 'El Toro'));
-- Then the Intamin woodies with no model at all (Carter, same day: "yeah").
UPDATE coasters SET model = 'Intamin Wood' WHERE manu = 'Intamin' AND model IS NULL AND type = 'Wood' AND ((park = 'Efteling' AND name = 'Pegasus') OR (park = 'Nagashima Spaland' AND name = 'White Cyclone') OR (park = 'Nara Dreamland' AND name = 'Unknown (2)'));
