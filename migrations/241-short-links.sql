-- Short links, coasterhub.org/t/<code> (Carter, 2026-11-25: the trip planner's
-- link is "sooo long"). The Worker creates this itself on the first POST to
-- /api/short, so nothing needs running; it is written down here so the table
-- is on record. Only paths on this site are stored, one code per address.
CREATE TABLE IF NOT EXISTS short_links (code TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, created TEXT, hits INTEGER NOT NULL DEFAULT 0);
