-- 016 — the two alias tables get a unique constraint, and lose their duplicates.
--
-- Why now: /api/admin/parks/rename writes park_aliases for the first time (a
-- park rename used to be "edit every coaster by hand", which recorded nothing),
-- and /park/<park>/<coaster> resolves URLs through both tables. A duplicate row
-- in there is not fatal — findPark and findCoaster take the first match — but it
-- is a list that grows every time a name is renamed back and forth, and it is
-- read on every page load that touches the coaster list.
--
-- It also makes an existing line honest. recordAlias() in worker.js has always
-- said INSERT OR IGNORE, which reads as "don't write this twice" — but with no
-- unique index there was nothing for OR IGNORE to ignore, so it only ever
-- protected against the NOT EXISTS guard it carries itself. After this migration
-- that line means what it says.
--
-- Safe to run twice: the deletes are no-ops once there is nothing to delete, and
-- both indexes are IF NOT EXISTS.

-- Keep the earliest row of each pair. rowid is stable here — neither table has
-- ever been rebuilt — and MIN keeps whichever was recorded first, which is the
-- one whose `note` and `added` columns say where it came from.
DELETE FROM coaster_aliases
 WHERE rowid NOT IN (SELECT MIN(rowid) FROM coaster_aliases GROUP BY coaster_id, former_name);

DELETE FROM park_aliases
 WHERE rowid NOT IN (SELECT MIN(rowid) FROM park_aliases GROUP BY park, former_name);

-- An alias that names its own subject's CURRENT name is not a former name, it
-- is noise — /add would answer "that's the old name, it's now X" about X. A
-- coaster rename already deletes this case for the one name it touches; this
-- clears any left from before that line existed.
DELETE FROM coaster_aliases
 WHERE EXISTS (SELECT 1 FROM coasters c
                WHERE c.id = coaster_aliases.coaster_id
                  AND c.name = coaster_aliases.former_name);

DELETE FROM park_aliases WHERE park = former_name;

CREATE UNIQUE INDEX IF NOT EXISTS coaster_aliases_uniq ON coaster_aliases(coaster_id, former_name);
CREATE UNIQUE INDEX IF NOT EXISTS park_aliases_uniq    ON park_aliases(park, former_name);
