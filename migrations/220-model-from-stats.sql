-- 220: fill in missing models from identical stats (Carter, 2026-11-21: "autoassign
-- models for a lot of the recently added coasters ... many of them don't have model
-- information"). 2,087 coasters carried no model, 1,760 of them with a maker.
--
-- The signal is the layout itself: a stock model repeats exactly. Every Vekoma SLC is
-- 109.3 ft / 2260.5 ft / 5 inversions, every Zierer Tivoli the same height and length
-- as the others. So a ride with NO model takes the model of the rides that already
-- have one when, for the SAME maker, they share height, length and inversions AND
-- those rides all agree on one model, AND at least two of them say so. Names are
-- never used (a ride called "Boomerang" is not necessarily one). A ride missing any
-- of maker/height/length is left alone, as is any layout shared by two models.
--
-- Idempotent: only touches rows whose model is empty. After it, re-run 216 so the
-- new SLCs / Tivolis / Spinners join their categories. No activity row: filling in a
-- model on an existing coaster does not go on /changes (CLAUDE.md, 2026-11-05).
WITH ref AS (
  SELECT manu, h, l, COALESCE(inv,0) AS inv, model, COUNT(*) AS n
  FROM coasters
  WHERE model IS NOT NULL AND model <> '' AND h IS NOT NULL AND l IS NOT NULL
  GROUP BY manu, h, l, COALESCE(inv,0), model
), uniq AS (
  SELECT manu, h, l, inv, MIN(model) AS model
  FROM ref GROUP BY manu, h, l, inv
  HAVING COUNT(*) = 1 AND SUM(n) >= 2
)
UPDATE coasters SET model = (
  SELECT u.model FROM uniq u
  WHERE u.manu = coasters.manu AND u.h = coasters.h AND u.l = coasters.l AND u.inv = COALESCE(coasters.inv,0))
WHERE (model IS NULL OR model = '') AND manu IS NOT NULL AND h IS NOT NULL AND l IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM uniq u
    WHERE u.manu = coasters.manu AND u.h = coasters.h AND u.l = coasters.l AND u.inv = COALESCE(coasters.inv,0));
