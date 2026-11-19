-- UNDO THE SWITCH (2026-11-19). Not run by anything: paste it only to put the
-- site back on the data it had before /cutover's "Switch now".
--
-- The switch (runCutover in worker.js) first copied every table it touches
-- into <table>_rcdb_backup, then blanked RCDB-only stats, applied the open
-- values and Carter's picks, renamed per step 5, removed the unridden
-- no-source coasters and hid parks left empty. This puts every one of those
-- tables back exactly as the backup holds it.
--
-- Rides and rankings made AFTER the switch on a coaster that the switch
-- removed cannot exist (the coaster was gone), and any made after it on other
-- coasters are untouched except `rankings`, which is restored whole: run the
-- rankings lines only if no rider has ranked since the switch.
-- After running: start the "Sync static JSON from D1" action.
DELETE FROM coasters;
INSERT INTO coasters SELECT * FROM coasters_rcdb_backup;
DELETE FROM parks;
INSERT INTO parks SELECT * FROM parks_rcdb_backup;
DELETE FROM coaster_aliases;
INSERT INTO coaster_aliases SELECT * FROM coaster_aliases_rcdb_backup;
DELETE FROM same_ride;
INSERT INTO same_ride SELECT * FROM same_ride_rcdb_backup;
DELETE FROM clone_members;
INSERT INTO clone_members SELECT * FROM clone_members_rcdb_backup;
DELETE FROM rider_category_members;
INSERT INTO rider_category_members SELECT * FROM rider_category_members_rcdb_backup;
DELETE FROM category_skipped;
INSERT INTO category_skipped SELECT * FROM category_skipped_rcdb_backup;
-- DELETE FROM rankings;
-- INSERT INTO rankings SELECT * FROM rankings_rcdb_backup;
-- Then, so the switch could run again: DROP TABLE coasters_rcdb_backup; (and the
-- other *_rcdb_backup tables), and DELETE FROM coaster_sources;
