-- 146: details for Cosmic Rewind (EPCOT) and Steel Curtain (Kennywood), from
-- Carter's RCDB screenshots, 2026-11-05. No activity rows on purpose — Carter:
-- "they don't need /changes additions" (filling in a blank stat is not news).
--   Cosmic Rewind: Vekoma family coaster (custom, spinning), 60.3 mph,
--     5,577.4 ft, 0 inversions, 3:10, 2022-05-27. RCDB gives no height.
--   Steel Curtain: S&S custom (no model), 220 ft, 75 mph, 4,000 ft, 8
--     inversions, 2:00, 2019-07-13. Only empty fields are filled.
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Family Coaster', s = 60.3, l = 5577.4, inv = 0, dur = 190, yr = 2022, opened = '2022-05-27', openedPrec = 'day' WHERE park = 'EPCOT' AND name = 'Guardians of the Galaxy: Cosmic Rewind' AND manu IS NULL;
UPDATE coasters SET h = COALESCE(h, 220.0), s = COALESCE(s, 75.0), l = COALESCE(l, 4000.0), inv = COALESCE(inv, 8), dur = COALESCE(dur, 120), yr = COALESCE(yr, 2019), opened = COALESCE(opened, '2019-07-13'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Kennywood' AND name = 'Steel Curtain';
