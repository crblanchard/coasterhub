-- Alpine slides off the site (Carter, 2026-11-21: "remove all the alpine
-- slides please"). An alpine slide is a sled in a concrete trough, not a
-- coaster. The twelve rides named "Alpine Slide" go (none ridden or ranked by anyone; the guards keep any that were);
-- Mineshaft Coaster (Alpine Slide at Magic Mountain) and Steamboat Howler are
-- alpine COASTERS on rails at parks with "Alpine Slide" in the name, and stay.
-- Their source pages are marked "not added" so the review does not offer them
-- again, and a park left with no coasters goes too.
-- Guarded; a second run does nothing.
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', l.source, l.ref, 0, 'reject', 'alpine slide (213)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links l JOIN coasters c ON c.id = l.coaster_id WHERE c.name = 'Alpine Slide' AND NOT EXISTS (SELECT 1 FROM rankings r WHERE r.coaster_id = c.id) AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.coaster_id = c.id);
DELETE FROM open_facts WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_aliases WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM clone_members WHERE coaster IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM same_ride WHERE coaster IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (SELECT id FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS _gone_parks (name TEXT PRIMARY KEY);
INSERT OR IGNORE INTO _gone_parks SELECT DISTINCT park FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM coasters WHERE name = 'Alpine Slide' AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM parks WHERE name IN (SELECT name FROM _gone_parks) AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
DROP TABLE IF EXISTS _gone_parks;
