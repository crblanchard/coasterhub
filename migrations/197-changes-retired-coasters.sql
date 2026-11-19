-- /changes entries about coasters the switch retired (Carter, 2026-11-19:
-- "remove stuff from /changes that impacted rides that no longer exist").
-- Ran on D1 2026-11-19: 193 rows (162 coaster_added, 27 coaster_edited, 3
-- coaster_renamed, 1 same_ride_removed), copied first into
-- activity_retired_backup. Merges into a coaster that still exists stay
-- (Psyke Underground -> Turbine, id 1604, is excluded on purpose).
-- To undo: INSERT INTO activity SELECT * FROM activity_retired_backup;
CREATE TABLE IF NOT EXISTS activity_retired_backup AS SELECT a.* FROM activity a WHERE json_valid(a.detail) AND (CAST(json_extract(a.detail,'$.id') AS INTEGER) IN (SELECT b.id FROM coasters_rcdb_backup b WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.id = b.id) AND b.id <> 1604) OR CAST(json_extract(a.detail,'$.coaster') AS INTEGER) IN (SELECT b.id FROM coasters_rcdb_backup b WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.id = b.id) AND b.id <> 1604) OR CAST(json_extract(a.detail,'$.to') AS INTEGER) IN (SELECT b.id FROM coasters_rcdb_backup b WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.id = b.id) AND b.id <> 1604));
DELETE FROM activity WHERE id IN (SELECT id FROM activity_retired_backup);
