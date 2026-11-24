-- 237: old tables nothing reads (Carter, 2026-11-24: "make a list of temp
-- pages ... so we can clean up the site backend" / "yes please"). A backup ran
-- first (backup.yml). Kept on purpose: the *_rcdb_backup tables (194 undoes the
-- open-data switch with them, and the switch checks they exist) and
-- open_matches (the weekly open-data job rewrites it).
--   credits                  the ride table from before `rides`; no code reads it
--   activity_retired_backup  197's undo copy of /changes rows for coasters
--                            retired at the switch
DROP TABLE IF EXISTS credits;
DROP TABLE IF EXISTS activity_retired_backup;
