-- Two rides that were each on the site twice (Carter, 2026-11-19: "merge
-- turbine and psyke underground, keep turbine. Same for [Tonnerre] 2 Zeus").
--   Psyké Underground (1604) -> Turbine (484), Walibi Belgium. One Schwarzkopf
--     Shuttle Loop under its names; the switch could not rename 1604 to
--     Turbine because 484 already had the name.
--   Tonnerre de Zeus (864) -> Tonnerre 2 Zeus (509), Parc Astérix. The same
--     ride before and after its 2023 rebuild.
-- The same steps as the Worker's merge route: the survivor's gaps filled from
-- the other row (COALESCE never overwrites), rides moved (an undated duplicate
-- folded, dated rides all kept), aliases moved, every table keyed by a coaster
-- repointed (OR IGNORE: the survivor's own row wins), the old name filed as a
-- former name ('merge'), a coaster_merged row for /changes. Open-dataset rows
-- for the removed ids are dropped too. Matched by id, read off D1 today.
-- Re-running is a no-op once the source rows are gone.

INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT 484, name, 'merge', '2026-11-19' FROM coasters WHERE id = 1604;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT 509, name, 'merge', '2026-11-19' FROM coasters WHERE id = 864;

UPDATE coasters SET type = COALESCE(type, (SELECT type FROM coasters WHERE id = 1604)), manu = COALESCE(manu, (SELECT manu FROM coasters WHERE id = 1604)), model = COALESCE(model, (SELECT model FROM coasters WHERE id = 1604)), h = COALESCE(h, (SELECT h FROM coasters WHERE id = 1604)), s = COALESCE(s, (SELECT s FROM coasters WHERE id = 1604)), l = COALESCE(l, (SELECT l FROM coasters WHERE id = 1604)), inv = COALESCE(inv, (SELECT inv FROM coasters WHERE id = 1604)), dur = COALESCE(dur, (SELECT dur FROM coasters WHERE id = 1604)), opened = COALESCE(opened, (SELECT opened FROM coasters WHERE id = 1604)), closed = COALESCE(closed, (SELECT closed FROM coasters WHERE id = 1604)) WHERE id = 484 AND EXISTS (SELECT 1 FROM coasters WHERE id = 1604);
UPDATE coasters SET type = COALESCE(type, (SELECT type FROM coasters WHERE id = 864)), manu = COALESCE(manu, (SELECT manu FROM coasters WHERE id = 864)), model = COALESCE(model, (SELECT model FROM coasters WHERE id = 864)), h = COALESCE(h, (SELECT h FROM coasters WHERE id = 864)), s = COALESCE(s, (SELECT s FROM coasters WHERE id = 864)), l = COALESCE(l, (SELECT l FROM coasters WHERE id = 864)), inv = COALESCE(inv, (SELECT inv FROM coasters WHERE id = 864)), dur = COALESCE(dur, (SELECT dur FROM coasters WHERE id = 864)), opened = COALESCE(opened, (SELECT opened FROM coasters WHERE id = 864)), closed = COALESCE(closed, (SELECT closed FROM coasters WHERE id = 864)) WHERE id = 509 AND EXISTS (SELECT 1 FROM coasters WHERE id = 864);

UPDATE rides SET coaster_id = 484 WHERE coaster_id = 1604;
UPDATE rides SET coaster_id = 509 WHERE coaster_id = 864;
DELETE FROM rides WHERE d IS NULL AND coaster_id IN (484, 509) AND id NOT IN (SELECT MIN(id) FROM rides WHERE d IS NULL AND coaster_id IN (484, 509) GROUP BY user_slug, coaster_id);

UPDATE OR IGNORE coaster_aliases SET coaster_id = 484 WHERE coaster_id = 1604;
UPDATE OR IGNORE coaster_aliases SET coaster_id = 509 WHERE coaster_id = 864;
DELETE FROM coaster_aliases WHERE coaster_id IN (1604, 864);

UPDATE OR IGNORE rankings SET coaster_id = 484 WHERE coaster_id = 1604;
UPDATE OR IGNORE rankings SET coaster_id = 509 WHERE coaster_id = 864;
DELETE FROM rankings WHERE coaster_id IN (1604, 864);
UPDATE OR IGNORE clone_members SET coaster = 484 WHERE coaster = 1604;
UPDATE OR IGNORE clone_members SET coaster = 509 WHERE coaster = 864;
DELETE FROM clone_members WHERE coaster IN (1604, 864);
UPDATE OR IGNORE rider_category_members SET coaster = 484 WHERE coaster = 1604;
UPDATE OR IGNORE rider_category_members SET coaster = 509 WHERE coaster = 864;
DELETE FROM rider_category_members WHERE coaster IN (1604, 864);
DELETE FROM category_skipped WHERE coaster IN (1604, 864);
DELETE FROM model_skipped WHERE coaster IN (1604, 864);
DELETE FROM same_ride WHERE coaster IN (1604, 864);

DELETE FROM coaster_sources WHERE coaster_id IN (1604, 864);
DELETE FROM open_links WHERE coaster_id IN (1604, 864);
DELETE FROM open_facts WHERE coaster_id IN (1604, 864);
DELETE FROM open_choices WHERE coaster_id IN (1604, 864);

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT '2026-11-19T03:00:00.000Z', NULL, 'coaster_merged', 'Turbine', NULL, json_object('from', 1604, 'to', 484, 'fromName', 'Psyké Underground', 'park', 'Walibi Belgium') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1604);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT '2026-11-19T03:00:00.000Z', NULL, 'coaster_merged', 'Tonnerre 2 Zeus', NULL, json_object('from', 864, 'to', 509, 'fromName', 'Tonnerre de Zeus', 'park', 'Parc Astérix') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 864);

DELETE FROM coasters WHERE id IN (1604, 864);
