-- 023 — same ride, relocated
--
-- A coaster that moved parks is ONE credit ridden in two places (Carter,
-- 2026-09-26: "when rides are relocated from park to park they should still
-- count as one credit only"). The database keeps it as two rows in `coasters`
-- on purpose — each park page and each rider's log should still show it at the
-- park it was ridden at — so what was missing is the link that says the rows
-- are one ride. Until now a rider who rode it at both parks got two credits.
--
-- One row per coaster in a set, INCLUDING the one the set is named after:
-- `ride` is that coaster's id, the ride's home now (usually the newer park).
-- So a set is `WHERE ride = ?`, and a rider's credit key for any coaster is
-- `COALESCE(same_ride.ride, coaster_id)` — which is exactly what the Worker's
-- counts use and what /api/coasters hands the pages as `same`.
--
-- Different from clone groups (012): a clone family is five DIFFERENT rides
-- that share a design, and each one is still its own credit. These are the
-- same physical ride, so the credit collapses. A coaster can be in both.
--
-- PRIMARY KEY on `coaster` alone: a coaster is in at most one set, and a
-- double-add is a failed insert rather than a coaster quietly in two. No
-- foreign keys (D1 has them off), so the Worker tidies a set when one of its
-- coasters is merged or deleted.
--
-- Nothing is linked by this file; the sets are made in /edit (a coaster's
-- "Same ride, relocated" box). Re-running this is a no-op.
CREATE TABLE IF NOT EXISTS same_ride (
  coaster INTEGER PRIMARY KEY,   -- one set per coaster, enforced here
  ride    INTEGER NOT NULL       -- the set's home: the coaster id it counts as
);

CREATE INDEX IF NOT EXISTS same_ride_ride ON same_ride(ride);
