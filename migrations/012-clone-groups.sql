-- 012 — clone groups
--
-- A set of coasters that are the SAME RIDE at different parks: the five Batman:
-- The Ride B&M Inverts, the Boomerangs, the SLCs. Ranking them one at a time is
-- eleven decisions to answer one question, and eleven rows of a top hundred
-- saying the same thing (Carter, 2026-09-18).
--
-- This is a fact about the coasters, not an opinion about them, so it lives
-- with the coaster data and is curated once in /edit rather than per rider.
-- Everyone's ranking can then collapse the same families.
--
-- What this table is NOT: it is not part of a ranking. A rider's `order` stays
-- exactly what it was — a flat list of coaster ids — and a group only decides
-- how the editor presents a contiguous run of them. That is deliberate: every
-- coaster keeps its own position, so the shared list, the 2+ averages and
-- "N ranked" all keep working without knowing groups exist.
--
-- A coaster belongs to at most one group. The PRIMARY KEY on `coaster` alone
-- says so in the schema rather than in a comment, which makes a double-add a
-- failed insert instead of a coaster that quietly appears in two families.
--
-- ON DELETE CASCADE is not available here (D1 has foreign keys off by default
-- and turning them on mid-life is its own migration), so deleting a group has
-- to clear its members in the same breath. The Worker does both.
--
-- Re-running this is a no-op.
CREATE TABLE IF NOT EXISTS clone_groups (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,           -- what the collapsed row says: "Batman: The Ride"
  note    TEXT,                    -- optional: "B&M Invert", the reason they are one
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clone_members (
  coaster  INTEGER PRIMARY KEY,    -- one group per coaster, enforced here
  group_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS clone_members_group ON clone_members(group_id);
