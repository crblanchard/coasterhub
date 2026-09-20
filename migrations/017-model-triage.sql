-- 017 — coasters looked at and left with no model on purpose
--
-- The models pane has a queue of its own now, and it needs the same third state
-- the categories queue needed in 015. `coasters.model` records which rides HAVE
-- a model; this records the other answer: "I have looked at this one and there
-- is no model to give it" — a park's one-off woodie, a kiddie coaster nobody
-- published a spec for.
--
-- With both, every coaster is in exactly one of:
--
--   has a model     — coasters.model is filled in
--   set aside       — this table has it
--   not looked at   — neither, which is the queue
--
-- A table of DECISIONS rather than a flag on `coasters`, for the same reason
-- 015 gave: a coaster added to the shared list tomorrow lands in the queue by
-- doing nothing, and one that gets a model later leaves the queue without
-- anything having to tidy up after it. A stale row here is harmless — the row
-- only counts while the coaster still carries no model.
--
-- Nothing rider-facing reads this. Re-running it is a no-op.
CREATE TABLE IF NOT EXISTS model_skipped (
  coaster INTEGER PRIMARY KEY,
  at      TEXT NOT NULL
);
