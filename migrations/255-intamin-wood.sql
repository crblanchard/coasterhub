-- American Eagle (Red)/(Blue) were model "Racer" and El Toro "Wood"; all three
-- are Intamin wooden coasters, so "Intamin Wood" like Balder and Colossos
-- (Carter, 2026-11-26: "trying to reduce categories as much as possible").
-- No activity row: a model fill on an existing coaster. Idempotent.
UPDATE coasters SET model = 'Intamin Wood' WHERE manu = 'Intamin' AND ((park = 'Six Flags Great America' AND name IN ('American Eagle (Red)', 'American Eagle (Blue)')) OR (park = 'Six Flags Great Adventure' AND name = 'El Toro'));
