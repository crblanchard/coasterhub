-- Trip links, coasterhub.org/trip/<name or code> (Carter, 2026-11-25: the
-- trip planner's link is "sooo long"; then "call it /trip and let me name the
-- trip"). The Worker creates this itself on the first POST to /api/trip-link,
-- so nothing needs running; it is written down here so the table is on record.
-- code is the typed name made into a slug, or a random 6-letter code; name is
-- what was typed (the trip's title), NULL for a code. Trip planner links only.
CREATE TABLE IF NOT EXISTS trip_links (code TEXT PRIMARY KEY, url TEXT NOT NULL, name TEXT, created TEXT, hits INTEGER NOT NULL DEFAULT 0);
