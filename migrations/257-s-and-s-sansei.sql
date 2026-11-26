-- S&S Worldwide became S&S - Sansei Technologies after Sansei (then Sansei
-- Yusoki) bought it in 2012-2014; the same company, renamed (Carter,
-- 2026-11-26: "everything that was s&s worldwide name it s&s sansei", checked
-- against Wikipedia and Coaster101). "Sansei Technologies" (the Japanese
-- parent's own rides) and "S&S Arrow" are left as they are. No activity row:
-- a maker string on existing coasters. Idempotent.
UPDATE coasters SET manu = 'S&S Sansei' WHERE manu = 'S&S Worldwide';
