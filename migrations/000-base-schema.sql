-- 000 — the tables that were already there
--
-- Numbered 000 because it is not a change to anything: it is the shape the
-- database had before 001 was written, reconstructed so a BRAND NEW D1 can be
-- stood up from nothing. Production has had these since before there were
-- migrations, so running this there does nothing at all.
--
-- What it is actually for: the staging copy (see STAGING.md). A fresh D1 has
-- no coasters table, and every other migration assumes one.
--
-- On a fresh database this file SUBSUMES two others, so do not run them:
--   002-activity  — its CREATE is repeated below; the rest of it is a day-one
--                   backfill from the alias table, which fails on a database
--                   with no history to recover.
--   008-profiles  — ALTER TABLE users ADD COLUMN bio/avatar; those columns are
--                   already in the users table below, so it errors as a
--                   duplicate.
-- The order for a brand new D1 is: 000, 003, 007, 010, 012. See STAGING.md.
--
-- Deliberately NOT here: accounts, sessions, invites, resets, follows,
-- clone_groups. Those each have their own numbered file and run after this one,
-- which keeps every table defined in exactly one place.
--
-- Re-running this is a no-op.

-- The shared list. `type` is Steel/Wood, `manu`/`model` are the maker and what
-- they call the layout, and the opened/closed pairs carry a precision flag
-- because plenty of dates are only known to the year.
CREATE TABLE IF NOT EXISTS coasters (
  id         INTEGER PRIMARY KEY,
  name       TEXT,
  park       TEXT,
  type       TEXT,
  manu       TEXT,
  model      TEXT,
  h          REAL,      -- height, feet
  s          REAL,      -- speed, mph
  l          REAL,      -- length, feet
  inv        INTEGER,   -- inversions
  dur        INTEGER,   -- duration, seconds
  laps       INTEGER,
  yr         INTEGER,
  opened     TEXT, openedPrec TEXT,
  closed     TEXT, closedPrec TEXT
);

-- Parks are keyed by their name, which is why renaming one has to rewrite every
-- coaster that points at it (see 004 for the same problem with riders).
CREATE TABLE IF NOT EXISTS parks (
  name   TEXT PRIMARY KEY,
  lat    REAL,
  lon    REAL,
  region TEXT            -- the grouping label: "Ohio, US", "Japan"
);

CREATE TABLE IF NOT EXISTS users (
  slug   TEXT PRIMARY KEY,
  name   TEXT,
  mode   TEXT,           -- vestigial since 001; every rider is 'rides' now
  email  TEXT,
  bio    TEXT,
  avatar TEXT
);

-- One row per lap. An undated row is a credit somebody ticked off a list from
-- memory; a dated one is a ride on a day. Both are the same thing here, which
-- is the whole point of 001.
CREATE TABLE IF NOT EXISTS rides (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_slug  TEXT,
  coaster_id INTEGER,
  d          TEXT
);

-- A ranking is one row per coaster, in position order. Flat on purpose: every
-- coaster keeps its own position, so the shared list, the 2+ averages and
-- "N ranked" can read it without knowing anything about how it was edited.
--
-- One row per position, NOT a JSON array: the shared list joins across every
-- rider's rankings, and a JSON blob cannot be joined. `PRIMARY KEY
-- (user_slug, coaster_id)` is what stops the same coaster appearing twice in
-- one list — a whole class of bug the writer would otherwise have to prevent.
CREATE TABLE IF NOT EXISTS rankings (
  user_slug  TEXT NOT NULL,
  coaster_id INTEGER NOT NULL,
  pos        INTEGER NOT NULL,
  PRIMARY KEY (user_slug, coaster_id)
);

-- The feed. Created here as well as in 002 (both IF NOT EXISTS) because 002 is
-- mostly a day-one BACKFILL from the alias table, and that half fails loudly on
-- a database with no history to recover. A fresh copy wants the table and none
-- of the backfill, so it gets the table here and skips 002 entirely.
CREATE TABLE IF NOT EXISTS activity (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      TEXT NOT NULL,
  actor   TEXT,
  kind    TEXT NOT NULL,
  subject TEXT,
  n       INTEGER,
  detail  TEXT
);
CREATE INDEX IF NOT EXISTS activity_at ON activity(at DESC, id DESC);

-- Renames keep the old name working. /api/coasters reads both of these on every
-- request, so a database without them 500s on the shared list.
CREATE TABLE IF NOT EXISTS coaster_aliases (coaster_id INTEGER, former_name TEXT);
CREATE TABLE IF NOT EXISTS park_aliases   (park TEXT,          former_name TEXT);

CREATE INDEX IF NOT EXISTS rides_user    ON rides(user_slug);
CREATE INDEX IF NOT EXISTS rides_coaster ON rides(coaster_id);
