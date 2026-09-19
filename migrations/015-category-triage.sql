-- 015 — coasters looked at and deliberately left out of every category
--
-- 012 records which coasters ARE in a category. This records the other answer:
-- "I have looked at this one and it belongs in none" (Carter, 2026-09-19).
--
-- The point is the THIRD state, which neither table holds on its own. With both
-- of them, every coaster in the database is in exactly one of:
--
--   in a category   — clone_members has it
--   set aside       — this table has it
--   not looked at   — neither does, which is the work queue
--
-- A coaster added to the shared list tomorrow lands in "not looked at" by
-- doing nothing at all, which is the whole reason this is a table of the
-- DECISIONS rather than a flag on `coasters`: a new row is untouched by
-- definition, and the queue fills itself.
--
-- Nothing on the rider-facing site reads this. A set-aside coaster is an
-- ordinary coaster to everybody; it is a note to the person curating.
--
-- Re-running this is a no-op.
CREATE TABLE IF NOT EXISTS category_skipped (
  coaster INTEGER PRIMARY KEY,
  at      TEXT NOT NULL
);
