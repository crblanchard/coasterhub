-- 034: Canyon Blaster at Six Flags Magic Mountain is Canyon Cruiser now
-- (2026-10-05). Carter: "Canyon blaster sfmm was renamed canyon cruiser ...
-- Name was changed 6/5/2026".
--
-- The live row had it backwards: coaster 65 was still called "Canyon Blaster"
-- with "Canyon Cruiser" filed as a FORMER name (note 'merge+hand', 2026-07-30),
-- so /add would have told anyone typing the new name it was the old one.
-- This flips it: the row takes the new name, the stale alias goes, and
-- "Canyon Blaster" becomes a former name noted 'renamed' with the real date,
-- which is what makes the coaster page read "Formerly Canyon Blaster
-- (1999 – June 5, 2026)". The activity row is what /edit's rename would have
-- written, so /changes shows it. Matched on name + park; safe to run twice.
UPDATE coasters SET name = 'Canyon Cruiser' WHERE name = 'Canyon Blaster' AND park = 'Six Flags Magic Mountain';
DELETE FROM coaster_aliases WHERE former_name = 'Canyon Cruiser' AND coaster_id IN (SELECT id FROM coasters WHERE name = 'Canyon Cruiser' AND park = 'Six Flags Magic Mountain');
INSERT INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Canyon Blaster', 'renamed', '2026-06-05' FROM coasters WHERE name = 'Canyon Cruiser' AND park = 'Six Flags Magic Mountain' ON CONFLICT(coaster_id, former_name) DO UPDATE SET note = 'renamed', added = excluded.added;
INSERT INTO activity (at, actor, kind, subject, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Canyon Cruiser', json_object('id', id, 'from', 'Canyon Blaster', 'park', 'Six Flags Magic Mountain', 'on', '2026-06-05') FROM coasters WHERE name = 'Canyon Cruiser' AND park = 'Six Flags Magic Mountain' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_renamed' AND subject = 'Canyon Cruiser');
