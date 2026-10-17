-- 061: Kentucky Kingdom's 2024 renames, which had left two rides listed twice.
--
-- Carter, 2026-10-17, with RCDB screenshots: Thunder Run (1990) is now
-- Woodland Run and Storm Chaser (2016) is now Wind Chaser. The site had the
-- old rows (#283, #284: full stats, most riders and every ranking but one)
-- AND bare rows under the new names (#1062, #1061) that imports had added.
--
-- Each pair becomes one coaster, done the way /api/admin/coasters/merge
-- does it but keeping the OLD row (its id, stats and rankings) and giving it
-- the new name:
--   1. activity first, while the names can still be read: coaster_merged
--      {from, to, fromName, park} and coaster_renamed {id, from, park};
--   2. the stub's rides, rankings, credits and category rows move to the old
--      row (UPDATE OR IGNORE then DELETE, so the old row wins a collision);
--      undated duplicate logs by one rider collapse to one;
--   3. the stub is deleted, the old row renamed, the old name kept as alias.
-- Checked live first: only unclepat had logged both versions (they lose the
-- duplicate credit for each, which is the point); Sean's ranking of Wind
-- Chaser moves across; nothing else collides.
--
-- Also Flying Fox (#1059, bare): Vekoma Suspended Family Coaster, 65 ft,
-- 37 mph, 1,380 ft, 1:03, opened 28 May 2026; into the Vekoma SFCs category.
-- Every statement is guarded so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Woodland Run', NULL, json_object('from', 1062, 'to', 283, 'fromName', 'Woodland Run', 'park', 'Kentucky Kingdom') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1062 AND name = 'Woodland Run' AND park = 'Kentucky Kingdom');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Woodland Run', NULL, json_object('id', 283, 'from', 'Thunder Run', 'park', 'Kentucky Kingdom') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1062 AND name = 'Woodland Run' AND park = 'Kentucky Kingdom');
UPDATE rides SET coaster_id = 283 WHERE coaster_id = 1062 AND EXISTS (SELECT 1 FROM coasters WHERE id = 283 AND name = 'Thunder Run');
DELETE FROM rides WHERE coaster_id = 283 AND d IS NULL AND id NOT IN (SELECT MIN(id) FROM rides WHERE coaster_id = 283 AND d IS NULL GROUP BY user_slug);
UPDATE OR IGNORE rankings SET coaster_id = 283 WHERE coaster_id = 1062;
DELETE FROM rankings WHERE coaster_id = 1062;
UPDATE OR IGNORE credits SET coaster_id = 283 WHERE coaster_id = 1062;
DELETE FROM credits WHERE coaster_id = 1062;
UPDATE OR IGNORE clone_members SET coaster = 283 WHERE coaster = 1062;
DELETE FROM clone_members WHERE coaster = 1062;
UPDATE OR IGNORE rider_category_members SET coaster = 283 WHERE coaster = 1062;
DELETE FROM rider_category_members WHERE coaster = 1062;
UPDATE OR IGNORE category_skipped SET coaster = 283 WHERE coaster = 1062;
DELETE FROM category_skipped WHERE coaster = 1062;
UPDATE OR IGNORE model_skipped SET coaster = 283 WHERE coaster = 1062;
DELETE FROM model_skipped WHERE coaster = 1062;
UPDATE OR IGNORE same_ride SET coaster = 283 WHERE coaster = 1062;
DELETE FROM same_ride WHERE coaster = 1062;
UPDATE OR IGNORE coaster_aliases SET coaster_id = 283 WHERE coaster_id = 1062;
DELETE FROM coaster_aliases WHERE coaster_id = 1062;
DELETE FROM coasters WHERE id = 1062 AND name = 'Woodland Run' AND park = 'Kentucky Kingdom' AND NOT EXISTS (SELECT 1 FROM rides WHERE coaster_id = 1062);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Thunder Run', 'rename', '2024' FROM coasters WHERE id = 283 AND name = 'Thunder Run';
UPDATE coasters SET name = 'Woodland Run' WHERE id = 283 AND name = 'Thunder Run' AND park = 'Kentucky Kingdom';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_merged', 'Wind Chaser', NULL, json_object('from', 1061, 'to', 284, 'fromName', 'Wind Chaser', 'park', 'Kentucky Kingdom') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1061 AND name = 'Wind Chaser' AND park = 'Kentucky Kingdom');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Wind Chaser', NULL, json_object('id', 284, 'from', 'Storm Chaser', 'park', 'Kentucky Kingdom') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 1061 AND name = 'Wind Chaser' AND park = 'Kentucky Kingdom');
UPDATE rides SET coaster_id = 284 WHERE coaster_id = 1061 AND EXISTS (SELECT 1 FROM coasters WHERE id = 284 AND name = 'Storm Chaser');
DELETE FROM rides WHERE coaster_id = 284 AND d IS NULL AND id NOT IN (SELECT MIN(id) FROM rides WHERE coaster_id = 284 AND d IS NULL GROUP BY user_slug);
UPDATE OR IGNORE rankings SET coaster_id = 284 WHERE coaster_id = 1061;
DELETE FROM rankings WHERE coaster_id = 1061;
UPDATE OR IGNORE credits SET coaster_id = 284 WHERE coaster_id = 1061;
DELETE FROM credits WHERE coaster_id = 1061;
UPDATE OR IGNORE clone_members SET coaster = 284 WHERE coaster = 1061;
DELETE FROM clone_members WHERE coaster = 1061;
UPDATE OR IGNORE rider_category_members SET coaster = 284 WHERE coaster = 1061;
DELETE FROM rider_category_members WHERE coaster = 1061;
UPDATE OR IGNORE category_skipped SET coaster = 284 WHERE coaster = 1061;
DELETE FROM category_skipped WHERE coaster = 1061;
UPDATE OR IGNORE model_skipped SET coaster = 284 WHERE coaster = 1061;
DELETE FROM model_skipped WHERE coaster = 1061;
UPDATE OR IGNORE same_ride SET coaster = 284 WHERE coaster = 1061;
DELETE FROM same_ride WHERE coaster = 1061;
UPDATE OR IGNORE coaster_aliases SET coaster_id = 284 WHERE coaster_id = 1061;
DELETE FROM coaster_aliases WHERE coaster_id = 1061;
DELETE FROM coasters WHERE id = 1061 AND name = 'Wind Chaser' AND park = 'Kentucky Kingdom' AND NOT EXISTS (SELECT 1 FROM rides WHERE coaster_id = 1061);
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Storm Chaser', 'rename', '2024' FROM coasters WHERE id = 284 AND name = 'Storm Chaser';
UPDATE coasters SET name = 'Wind Chaser' WHERE id = 284 AND name = 'Storm Chaser' AND park = 'Kentucky Kingdom';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu','model','h','s','l','inv','dur','yr','opened','openedPrec'), 'via', '061') FROM coasters WHERE name = 'Flying Fox' AND park = 'Kentucky Kingdom' AND l IS NULL;
UPDATE coasters SET type = 'Steel', manu = 'Vekoma', model = 'Vekoma Suspended Family Coaster', h = 65, s = 37, l = 1380, inv = 0, dur = 63, yr = 2026, opened = '2026-05-28', openedPrec = 'day' WHERE name = 'Flying Fox' AND park = 'Kentucky Kingdom' AND l IS NULL;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Flying Fox' AND c.park = 'Kentucky Kingdom' AND g.name = 'Vekoma SFCs';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 0, 'via', '061') FROM clone_groups g WHERE g.name = 'Vekoma SFCs' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"061"%');
