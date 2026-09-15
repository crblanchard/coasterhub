-- Sean's last two credits, settled 2026-09-15.
--
-- His page carried a standing note: when Carter's Europe 2025 and Japan 2026
-- rides were copied across, two coasters were left off because it wasn't clear
-- they should count — Free Fall at Nagashima Spaland and Supersplash at
-- Plopsaland. Everyone else who was there those days has them. Carter's call is
-- that Sean has them too, which takes him 670 -> 672.
--
-- Matched on name + park rather than the IDs (537 and 502 today): a coaster's
-- row id is stable but invisible, and a lookup that finds nothing inserts
-- nothing, where a wrong hardcoded id would quietly credit the wrong ride.
--
-- The dates are the days Sean was already logged as being at those parks, which
-- are the same days Carter rode them. Undated would have counted too, but it
-- would have left two rides floating outside the trips they belong to.
--
-- NOT EXISTS makes this safe to run twice: a credit Sean already has is skipped
-- rather than added as a second ride.
INSERT INTO rides (user_slug, coaster_id, d)
SELECT 'sean', c.id, v.d
  FROM coasters c
  JOIN (          SELECT 'Free Fall'   AS name, 'Nagashima Spaland'  AS park, '2026-03-12' AS d
        UNION ALL SELECT 'Supersplash'      ,   'Plopsaland Belgium'      ,   '2025-04-15'     ) v
    ON v.name = c.name AND v.park = c.park
 WHERE NOT EXISTS (SELECT 1 FROM rides r WHERE r.user_slug = 'sean' AND r.coaster_id = c.id);

-- Should read 672 credits / 723 rides.
SELECT COUNT(DISTINCT coaster_id) AS credits, COUNT(*) AS rides
  FROM rides WHERE user_slug = 'sean';
