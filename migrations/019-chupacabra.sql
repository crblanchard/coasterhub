-- 019 — put Chupacabra back together, and finish what 018 could not
--
-- Two separate faults, one ride.
--
-- 1. THE SPECS. Merging #137 (Goliath, Six Flags Fiesta Texas — a B&M Invert
--    with every number filled in) into #1199 (Chupacabra, the stub row the new
--    name was typed into) kept the stub and deleted the filled row. That is
--    what a merge has always done: it moved the rides and the former names and
--    took no interest in the columns. worker.js fills the survivor's gaps from
--    the row going away now, the same way a park merge fills its survivor's
--    coordinates — but the code cannot get back what has already gone.
--
--    The values below are Goliath's own, read off the repo's `coasters.json`
--    export, which still carries id 137 because the static sync has not run
--    since the merge. They are restored by COALESCE, so anything Carter has
--    typed into Chupacabra since is left exactly as it is, and re-running this
--    file changes nothing.
--
--    `opened` is 2008-04-18, which is what the row said: the day it opened at
--    Fiesta Texas. If the retheme date is wanted instead, that is a decision
--    and belongs in /edit, not in a repair.
--
-- 2. THE CATEGORY. 018 was meant to move the Batman clones membership from the
--    dead id to the survivor, and it did not — Carter: "chupacabra lost all its
--    stats and its not under batman". Whatever stopped it matching, the DELETE
--    at the end of each block then removed the row, which was too eager: an
--    unresolved membership is a question, not rubbish. Nothing in `activity`
--    records which coasters were in a category (clone_set stores a count, not
--    ids), so the membership cannot be recovered in general — only this one,
--    which is known.
--
-- Everything below matches on NAME AND PARK rather than an id read off a
-- snapshot, per CLAUDE.md, and every statement is guarded so a second run is a
-- no-op.
--
-- IT DID NOT TAKE (Carter, 2026-09-20): pasted, and Chupacabra was still bare.
-- Which statement missed is not knowable from here — a repair matched on
-- name + park is only as good as the names, and nothing in this sandbox can
-- read the live row to check them. The fix went in through the API instead,
-- which is the path CLAUDE.md names for exactly this case and is strictly
-- better here: it goes through the Worker, so it records activity and fires the
-- static sync, and it finds the coaster by asking rather than by guessing what
-- it is called. See "Repairing one row" in the handoff for the snippet, which
-- is driven against the real worker in a browser rather than hoped at.
--
-- This file stays as the record of what the values were and where they came
-- from. After the API fix every statement below is a no-op, which is what a
-- COALESCE repair is for.

-- 1. The specs, filling gaps only.
UPDATE coasters SET
  type       = COALESCE(type,       'Steel'),
  manu       = COALESCE(manu,       'Bolliger & Mabillard'),
  model      = COALESCE(model,      'B&M Invert'),
  h          = COALESCE(h,          105),
  s          = COALESCE(s,          50),
  l          = COALESCE(l,          2693),
  inv        = COALESCE(inv,        5),
  dur        = COALESCE(dur,        120),
  laps       = COALESCE(laps,       1),
  yr         = COALESCE(yr,         2008),
  opened     = COALESCE(opened,     '2008-04-18'),
  openedPrec = COALESCE(openedPrec, 'day')
WHERE name = 'Chupacabra' AND park = 'Six Flags Fiesta Texas';

-- 2. Back into Batman clones, unless it is already in a category of its own.
INSERT INTO clone_members (coaster, group_id)
SELECT c.id, g.id
  FROM coasters c, clone_groups g
 WHERE c.name = 'Chupacabra' AND c.park = 'Six Flags Fiesta Texas'
   AND g.name = 'Batman clones'
   AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);

-- 3. And any other dead reference 018 left behind, matched on BOTH sides as
--    integers this time. json_extract returns whatever type the JSON held, and
--    SQLite does not compare a text '137' equal to an integer 137 — if that is
--    what stopped 018, this is the fix; if it is not, this is a no-op. It does
--    NOT delete what it cannot resolve: a row naming a coaster that is gone is
--    a question for a person, and deleting it is how the answer gets lost.
UPDATE OR IGNORE clone_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND CAST(json_extract(a.detail,'$.from') AS INTEGER) = clone_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);

UPDATE OR IGNORE rankings SET coaster_id = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND CAST(json_extract(a.detail,'$.from') AS INTEGER) = rankings.coaster_id
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster_id NOT IN (SELECT id FROM coasters);

UPDATE OR IGNORE rider_category_members SET coaster = (
  SELECT CAST(json_extract(a.detail,'$.to') AS INTEGER) FROM activity a
   WHERE a.kind = 'coaster_merged'
     AND CAST(json_extract(a.detail,'$.from') AS INTEGER) = rider_category_members.coaster
   ORDER BY a.id DESC LIMIT 1)
 WHERE coaster NOT IN (SELECT id FROM coasters);
