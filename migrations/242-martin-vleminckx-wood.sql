-- Every Martin & Vleminckx wooden coaster gets the model "Martin & Vleminckx
-- Wood", the way GCI and CCI woodies read "GCI Wood" / "CCI Wood" (Carter,
-- 2026-11-25). 13 rows on D1 that day: Boardwalk Bullet had "M&V Wood", the
-- other 12 (Zippin Pippin, Leviathan, the Jungle Trailblazers, Fireball ...)
-- had none. Matched on maker + type, so a re-run changes nothing.
UPDATE coasters SET model = 'Martin & Vleminckx Wood' WHERE manu = 'Martin & Vleminckx' AND type = 'Wood' AND (model IS NULL OR model <> 'Martin & Vleminckx Wood');
