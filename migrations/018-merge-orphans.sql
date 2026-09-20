-- 018 — put back what earlier merges dropped on the floor
--
-- Merging coaster A into coaster B moved A's rides and A's former names and
-- nothing else. Everything else keyed by A's id was left pointing at a row that
-- the same merge deleted:
--
--   clone_members           A's category membership. Carter merged Goliath
--                           (Six Flags Fiesta Texas) into Chupacabra on
--                           2026-09-20 and the Batman clones category was left
--                           listing "#137" while Chupacabra inherited nothing.
--   rankings                quieter and worse: the row survives pointing at an
--                           id nothing resolves, so the ride simply stops
--                           appearing in that rider's list.
--   rider_category_members  the same as clone_members, per rider.
--   category_skipped        a set-aside decision about a coaster that is gone.
--
-- worker.js carries all of these through a merge now. This repairs the ones
-- already broken, which the code cannot do for itself.
--
-- WHERE THE ANSWER COMES FROM: every merge writes an activity row —
-- kind 'coaster_merged', detail {"from":<id>,"to":<id>} — so the id a dead
-- reference should have become is already written down. The 44 rows backfilled
-- by hand in 2026-07 put the NAME in `from` rather than an id; those do not
-- match an integer id and are left alone, which is right — they predate every
-- table below.
--
-- UPDATE OR IGNORE is what handles a collision: if the survivor is already in
-- a category, or already ranked by that rider, its own row wins and the dead
-- one is deleted below rather than the statement failing. A row whose subquery
-- finds nothing is set to NULL, which the primary key refuses, so it is left
-- untouched by the same OR IGNORE — and then deleted, because a membership or
-- a ranking naming a coaster that does not exist can never be rendered.
--
-- Run three times over, so A→B→C chains resolve a hop at a time.
-- Re-running the whole file is a no-op: after it, nothing dangles.

-- clone_members --------------------------------------------------------------
UPDATE OR IGNORE clone_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = clone_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
UPDATE OR IGNORE clone_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = clone_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
UPDATE OR IGNORE clone_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = clone_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
DELETE FROM clone_members WHERE coaster NOT IN (SELECT id FROM coasters);

-- rankings -------------------------------------------------------------------
UPDATE OR IGNORE rankings SET coaster_id = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = rankings.coaster_id
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster_id NOT IN (SELECT id FROM coasters);
UPDATE OR IGNORE rankings SET coaster_id = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = rankings.coaster_id
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster_id NOT IN (SELECT id FROM coasters);
UPDATE OR IGNORE rankings SET coaster_id = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = rankings.coaster_id
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster_id NOT IN (SELECT id FROM coasters);
DELETE FROM rankings WHERE coaster_id NOT IN (SELECT id FROM coasters);

-- rider_category_members -----------------------------------------------------
UPDATE OR IGNORE rider_category_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = rider_category_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
UPDATE OR IGNORE rider_category_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = rider_category_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
DELETE FROM rider_category_members WHERE coaster NOT IN (SELECT id FROM coasters);

-- category_skipped -----------------------------------------------------------
UPDATE OR IGNORE category_skipped SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND json_extract(a.detail,'$.from') = category_skipped.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
DELETE FROM category_skipped WHERE coaster NOT IN (SELECT id FROM coasters);
