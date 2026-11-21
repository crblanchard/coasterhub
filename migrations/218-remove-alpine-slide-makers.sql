-- 218: everything built by Alpine Slide Corp. / Alpine Slide, LLC goes
-- (Carter, 2026-11-22: "everything made by these guys should go i'm sure
-- they're more alpine slides"). Three rides, none ridden or ranked: Bobbane
-- (Beitostølen Resort), Crystal Coaster (Crystal Mountain), Steamboat Howler
-- (Steamboat Springs Alpine Slide). Same steps as 213: their source links are
-- marked rejected so the weekly refresh doesn't offer them again, and the
-- three parks go too, since nothing else is left at them.
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', l.source, l.ref, 0, 'reject', 'alpine slide (218)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links l WHERE l.coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_facts WHERE coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_choices WHERE coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_aliases WHERE coaster_id IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM clone_members WHERE coaster IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM same_ride WHERE coaster IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (SELECT id FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS _gone_parks (name TEXT PRIMARY KEY);
INSERT OR IGNORE INTO _gone_parks SELECT DISTINCT park FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM coasters WHERE manu IN ('Alpine Slide Corp.', 'Alpine Slide, LLC') AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM parks WHERE name IN (SELECT name FROM _gone_parks) AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
DROP TABLE IF EXISTS _gone_parks;
