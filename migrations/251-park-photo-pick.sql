-- Carter's pick for a park's lead photo (Change photo on the park page, admins
-- only; Carter, 2026-11-26: "give me change photo too on park pages"). url is
-- one of open_park_gallery's for that park, or 'none' to hide the park's
-- photos; no row means the best-scored one leads. worker.js makes this table on
-- the first pick itself; written down here so it is on record.
CREATE TABLE IF NOT EXISTS park_photo_pick (park TEXT PRIMARY KEY, url TEXT NOT NULL, by TEXT, at TEXT);
