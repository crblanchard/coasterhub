-- Backfill: everything already ranked becomes a credit.
--
-- putRankings() credits a ranked coaster from 2026-09-14 onward (see
-- creditRanked in worker.js), but only when a ranking is next SAVED. Anything
-- ranked before that deploy is still missing from its rider's count. This
-- closes that gap once, for rankings that already exist.
--
-- Undated (d NULL) for the same reason the live path is: a ranking carries no
-- date. NOT EXISTS makes it idempotent — running it twice adds nothing the
-- second time — and it only ever inserts, never deletes, so no ride history can
-- be lost by running it.
--
-- It writes no `activity` row. The feed is a record of things people did, and
-- this is a correction to data that was already there.
--
-- CHECK FIRST. This changes counts that are shown publicly, so look at what it
-- would do before doing it:
--
--   SELECT k.user_slug, COUNT(*) AS would_gain
--   FROM rankings k
--   WHERE NOT EXISTS (SELECT 1 FROM rides r
--                     WHERE r.user_slug = k.user_slug AND r.coaster_id = k.coaster_id)
--   GROUP BY k.user_slug ORDER BY would_gain DESC;
--
-- A rider who ranked only what they had logged shows 0 and is untouched. A big
-- number against one of the original four riders is worth understanding before
-- you run this rather than after — it would mean they had been ranking
-- coasters they never logged, and their count is about to jump.

-- Every rider. To do a single one instead, add:  AND k.user_slug = 'firepheonix'
INSERT INTO rides (user_slug, coaster_id, d)
SELECT k.user_slug, k.coaster_id, NULL
FROM rankings k
WHERE NOT EXISTS (
  SELECT 1 FROM rides r
  WHERE r.user_slug = k.user_slug AND r.coaster_id = k.coaster_id
);
