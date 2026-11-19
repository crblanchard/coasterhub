-- The starting list for /cutover's "no open source" tracker (2026-11-19):
-- every coaster someone has ridden (any location of a relocated ride) that
-- no open source covers. Fixed on purpose, so the tracker only goes up: a
-- coaster leaves "to do" when it gains an open source or Carter keeps it to
-- enter by hand, but it never leaves the list. Open dataset only.
-- Ran on D1 2026-11-19: 124 coasters. Re-runnable: INSERT OR IGNORE keeps
-- the first snapshot.
CREATE TABLE IF NOT EXISTS open_launch_baseline (coaster_id INTEGER PRIMARY KEY, riders INTEGER, added TEXT);
INSERT OR IGNORE INTO open_launch_baseline (coaster_id, riders, added)
WITH grp AS (SELECT c.id, COALESCE(s.ride, c.id) g FROM coasters c LEFT JOIN same_ride s ON s.coaster = c.id),
rg AS (SELECT g.g, COUNT(DISTINCT r.user_slug) n FROM rides r JOIN grp g ON g.id = r.coaster_id GROUP BY g.g)
SELECT c.id, rg.n, '2026-11-19' FROM coasters c JOIN grp ON grp.id = c.id JOIN rg ON rg.g = grp.g LEFT JOIN parks p ON p.name = c.park
WHERE NOT EXISTS (SELECT 1 FROM open_links l WHERE l.coaster_id = c.id) AND COALESCE(p.travel, 0) = 0;
