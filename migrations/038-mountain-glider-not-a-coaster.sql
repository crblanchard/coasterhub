-- 038: the Mountain Glider is not a credit (Carter, 2026-10-17: "i feel like
-- this shouldnt be a credit", then "delete both don't say the ride by keltan
-- went with it though"). It is a gravity glider — a rider in a harness hangs
-- from a trolley, zipline-style; RCDB does not list it. It was also filed at
-- the wrong park (it is at Rowdy Bear Mountain, Gatlinburg, not Ripley's).
-- Both halves go: (Left) #1099, ridden only by Keltan (bugmonster1,
-- 2019-11-17, unranked — his count drops by one), and (Right) #1765, added
-- by 037 the same day, ridden by nobody. Nothing else referenced either.
-- The /changes rows say only that each was deleted, with no rider named, as
-- Carter asked. Run by hand through the D1 connector on Carter's say-so.
DELETE FROM rides WHERE coaster_id = 1099 AND user_slug = 'bugmonster1';
DELETE FROM coasters WHERE id IN (1099, 1765) AND name IN ('Mountain Glider (Left)', 'Mountain Glider (Right)') AND park = 'Ripley''s Mountain Coaster' AND NOT EXISTS (SELECT 1 FROM rides WHERE coaster_id IN (1099, 1765));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_deleted', x.name, NULL, json_object('id', x.id, 'park', 'Ripley''s Mountain Coaster') FROM (SELECT 1099 id, 'Mountain Glider (Left)' name UNION ALL SELECT 1765, 'Mountain Glider (Right)') x WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE id = x.id) AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_deleted' AND subject = x.name);
