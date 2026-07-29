-- Collapse the two storage modes into one.
--
-- Before: `rides` held Carter only (one row per lap, dated). `credits` held
-- Cole, Keltan and Max (one row per coaster, UNIQUE(user,coaster), date
-- nullable). Every read path in worker.js and app.js branched on users.mode.
--
-- After: `rides` holds everyone, with `d` nullable. A credit is a derived
-- thing -- COUNT(DISTINCT coaster_id) -- and first-ridden is MIN(d).
--
-- This is lossless. `credits.n` (ride counts) is NULL on all 1,767 rows, so
-- each credit maps to exactly one ride row. `credits.num` (Max's milestone
-- numbering, 426 rows) is deliberately dropped -- Carter's call; the two
-- places that render it already self-hide when it is absent.
--
-- Run step 1 alone first and check the counts hold. `credits` is left in
-- place as the backup; step 3 is only safe once the code no longer reads it.

-- 1. copy -------------------------------------------------------------------
INSERT INTO rides (user_slug, coaster_id, d)
  SELECT user_slug, coaster_id, first FROM credits ORDER BY user_slug, id;

-- 2. flip the readers -------------------------------------------------------
UPDATE users SET mode = 'rides' WHERE mode = 'credits';

-- 3. drop the old table -- ONLY after the code is switched over and verified
-- DROP TABLE credits;

-- Verification. `credits` has UNIQUE(user_slug, coaster_id), so today's
-- COUNT(*) must equal tomorrow's COUNT(DISTINCT coaster_id) exactly. The id
-- checksum is what catches a swapped pair, which counts alone would hide.
--
--   SELECT user_slug, COUNT(DISTINCT coaster_id) n, SUM(DISTINCT coaster_id) s,
--          SUM(d IS NULL) undated
--     FROM rides GROUP BY user_slug;
--
-- Expected:
--   carter   562  159439  undated 0     (2362 rows -- unchanged, has laps)
--   cole     546  193652  undated 243
--   keltan   795  454445  undated 198
--   max      426  194626  undated 426
