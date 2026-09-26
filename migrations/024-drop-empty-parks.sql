-- 024: remove the nine parks that hold no coasters at all (Carter, 2026-09-26:
-- "remove parks with 0 operating & 0 defunct like alameda county fair. for now
-- I guess just one-time thing not a recurring system").
--
-- Found against D1 the same day: parks with no row in `coasters` pointing at
-- them. Most are fairs and traveling-show stops that were entered as a place
-- and never given a ride; two (Gatlinburg Mountain Coaster, Olympic Bobsled)
-- are coaster names that were entered as parks. None has a park_aliases row,
-- nothing else is keyed by a park name, so the delete is the whole job.
--
-- One-time by design: the names are listed rather than "every park with no
-- coasters", so a park added tomorrow for a ride not logged yet is not swept
-- up if this is pasted again. The NOT EXISTS guard means a park that has
-- gained a coaster since is left alone, and a second run deletes nothing.
--
-- Raw SQL skips the Worker: afterwards run Actions -> "Sync static JSON from
-- D1" so parks.json drops them too.
--
-- Check first:
--   SELECT name FROM parks p WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = p.name);
DELETE FROM parks
WHERE name IN (
  'Alameda County Fair',
  'Beyond Wonderland',
  'Branson Sawmill',
  'Gatlinburg Mountain Coaster',
  'Olympic Bobsled',
  'Orange County Fair',
  'S.J. Entertainment (Vander Vorste, Steve)',
  'San Diego County Fair',
  'Washington Town & Country Fair'
)
AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
