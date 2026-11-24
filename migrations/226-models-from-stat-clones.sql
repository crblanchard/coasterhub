-- 226: models from exact stat clones (Carter, 2026-11-24: "maybe based on
-- stats find clones"). A coaster with no model takes the model of coasters by
-- the same maker with the same height and length (rounded to the foot), when
-- every such coaster agrees on one model. 23 on 2026-11-24. Three matches
-- looked wrong and are excluded: TRON Lightcycle Power Run (a Vekoma
-- Motorbike, set by hand below, not a Family Coaster), Hornet at Wonderland
-- Park ("Indoor") and Screamin' Delta Demon ("Bobsled"). Then re-run 216.
UPDATE coasters SET model = (SELECT MIN(o.model) FROM coasters o WHERE o.model IS NOT NULL AND o.manu = coasters.manu AND ROUND(o.h,0) = ROUND(coasters.h,0) AND ROUND(o.l,0) = ROUND(coasters.l,0) HAVING COUNT(DISTINCT o.model) = 1) WHERE model IS NULL AND manu IS NOT NULL AND h IS NOT NULL AND l IS NOT NULL AND NOT (name = 'TRON Lightcycle Power Run' OR (name = 'Hornet' AND park = 'Wonderland Park') OR name = 'Screamin'' Delta Demon') AND (SELECT COUNT(DISTINCT o.model) FROM coasters o WHERE o.model IS NOT NULL AND o.manu = coasters.manu AND ROUND(o.h,0) = ROUND(coasters.h,0) AND ROUND(o.l,0) = ROUND(coasters.l,0)) = 1;
UPDATE coasters SET model = 'Vekoma Motorbike' WHERE name = 'TRON Lightcycle Power Run' AND model IS NULL;
