-- 013 — a rider's own categories
--
-- 012 gave the site ONE set of categories, curated in /edit: the five Batmans,
-- the Boomerangs, the SLCs. Facts about the coasters, the same for everybody.
-- This adds the other half — a rider's own, which are opinions and are theirs
-- alone (Carter, 2026-09-18).
--
-- THE RULE THAT KEEPS THIS SIMPLE: a rider may not build their own category out
-- of coasters that are in one of the site's. Carter's call, and it is the right
-- one — letting somebody fork "Batman: The Ride" into their own slightly
-- different Batman means two definitions of the same thing, a merge every time
-- the site's changes, and no answer to "have you been on more Batmans than me".
-- Don't want the site's Batmans? Switch that category off and they go back to
-- being ordinary rows you rank one at a time. What you cannot do is switch it
-- off and then rebuild it as your own — that is the copy, and it is refused
-- either way. The Worker enforces this on write; it is not advice.
--
-- What this is NOT, again: it is not part of a ranking. `rankings` stays one
-- row per coaster per rider, and a category only decides how the editor draws a
-- contiguous run of them. Everything downstream — the shared list, the 2+
-- averages, "N ranked" — keeps working without knowing categories exist.
--
-- Re-running this is a no-op.

-- One row per category a rider wrote. `user_slug` rather than an account id
-- because everything else in this database that belongs to a person is keyed by
-- slug (rides, rankings, follows), and 004 already knows how to rename one.
CREATE TABLE IF NOT EXISTS rider_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_slug TEXT NOT NULL,
  name      TEXT NOT NULL,
  note      TEXT,
  created   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rider_categories_user ON rider_categories(user_slug);

-- A coaster is in at most one of a rider's categories. The PRIMARY KEY says so,
-- the same way clone_members does — a double-add is a failed insert rather than
-- a coaster that quietly folds into two rows at once.
CREATE TABLE IF NOT EXISTS rider_category_members (
  user_slug TEXT NOT NULL,
  coaster   INTEGER NOT NULL,
  cat_id    INTEGER NOT NULL,
  PRIMARY KEY (user_slug, coaster)
);
CREATE INDEX IF NOT EXISTS rider_category_members_cat ON rider_category_members(cat_id);

-- Everything a rider has decided ABOUT categories, as one JSON blob per rider:
--
--   {"on":true,"off":["c1","r7"],"nums":["c2"]}
--
-- `c1` is clone_groups id 1, `r7` is rider_categories id 7 — two id spaces that
-- would otherwise collide. `off` is a category they keep but are not using;
-- `nums` is one showing real positions instead of ~.
--
-- A blob rather than a row per preference because nothing ever queries across
-- riders' preferences: the ranking page reads one rider's and writes one
-- rider's. `rankings` is rows because the shared list JOINS them; this does not.
CREATE TABLE IF NOT EXISTS category_prefs (
  user_slug TEXT PRIMARY KEY,
  prefs     TEXT,
  updated   TEXT
);
