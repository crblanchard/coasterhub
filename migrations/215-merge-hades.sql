-- 215: Hades (758) and Hades 360 (331) at Mt. Olympus are one credit
-- (Carter, 2026-11-22: "hades and hades 360 are the same credit. make hades
-- past name 2005-2012"). Same merge as 195: 331 keeps its id; 758's riders,
-- rankings and opening date move onto it; "Hades" becomes a former name.
-- Note 'renamed' with added '2012' is what makes the page say
-- "Formerly Hades (2005 – 2012)": the range runs from the opening to `added`.
INSERT INTO coaster_aliases (coaster_id, former_name, note, added) VALUES (331, 'Hades', 'renamed', '2012')
  ON CONFLICT(coaster_id, former_name) DO UPDATE SET note = 'renamed', added = '2012';
UPDATE coasters SET opened = COALESCE(opened, (SELECT opened FROM coasters WHERE id = 758)) WHERE id = 331 AND EXISTS (SELECT 1 FROM coasters WHERE id = 758);
UPDATE rides SET coaster_id = 331 WHERE coaster_id = 758;
DELETE FROM rides WHERE d IS NULL AND coaster_id = 331 AND id NOT IN (SELECT MIN(id) FROM rides WHERE d IS NULL AND coaster_id = 331 GROUP BY user_slug, coaster_id);
UPDATE OR IGNORE rankings SET coaster_id = 331 WHERE coaster_id = 758;
DELETE FROM rankings WHERE coaster_id = 758;
UPDATE OR IGNORE clone_members SET coaster = 331 WHERE coaster = 758;
DELETE FROM clone_members WHERE coaster = 758;
UPDATE OR IGNORE rider_category_members SET coaster = 331 WHERE coaster = 758;
DELETE FROM rider_category_members WHERE coaster = 758;
DELETE FROM category_skipped WHERE coaster = 758;
DELETE FROM model_skipped WHERE coaster = 758;
DELETE FROM same_ride WHERE coaster = 758;
DELETE FROM coaster_aliases WHERE coaster_id = 758;
DELETE FROM coaster_sources WHERE coaster_id = 758;
DELETE FROM open_links WHERE coaster_id = 758;
DELETE FROM open_facts WHERE coaster_id = 758;
DELETE FROM open_choices WHERE coaster_id = 758;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Hades 360', NULL, json_object('from', 758, 'to', 331, 'fromName', 'Hades', 'park', 'Mt. Olympus') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 758);
DELETE FROM coasters WHERE id = 758;
