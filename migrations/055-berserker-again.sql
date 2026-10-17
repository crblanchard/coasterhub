-- 055: delete Berserker (California's Great America) — again.
--
-- It was deleted on 2026-09-21 (coaster_deleted, old id 590: not a real
-- credit). Migration 027 (2026-10-04) then put it back as id 1621, because the
-- friend's ranking sheet 027 was built from still listed it and 027 matched
-- on name + park, which no longer existed. Carter, 2026-10-17: "Delete it
-- it's not a credit. I meant I thought we already removed it".
--
-- Nobody has logged, ranked or categorised 1621 (checked live first), so
-- this removes nothing but the row. Matched on name + park, so a second run
-- is a no-op. Lesson for the next import batch: check /changes for a
-- coaster_deleted of the same name + park before re-adding it.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_deleted', c.name, NULL, json_object('id', c.id, 'park', c.park, 'riders', json_array(), 'rides', 0)
  FROM coasters c WHERE c.name = 'Berserker' AND c.park = 'California''s Great America';
DELETE FROM coasters WHERE name = 'Berserker' AND park = 'California''s Great America' AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.coaster_id = coasters.id);
