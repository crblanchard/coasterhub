-- 050: delete "Christmas in the Park" (California).
--
-- Carter, 2026-10-17: "Delete Christmas in the park." It has no coasters, no
-- aliases and no pin (it was the one non-travelling park without
-- coordinates), and nothing on /changes ever named it, so there is no
-- activity row to write: removing an empty park changes nothing riders see.
--
-- The guard keeps it from taking a park that has gained a coaster since.
-- A second run is a no-op.

DELETE FROM parks WHERE name = 'Christmas in the Park' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Christmas in the Park');
