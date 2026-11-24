-- 236: Carter's own choice of photo per coaster (2026-11-24: "let you choose
-- the photo yourself"), made from the Change photo button an admin sees on a
-- coaster page. A copy of the chosen photo's details, so it stays put when the
-- weekly refresh rebuilds open_images / open_gallery. url 'none' = no photo.
CREATE TABLE IF NOT EXISTS coaster_photo_pick (coaster_id INTEGER PRIMARY KEY, url TEXT NOT NULL, thumb TEXT, width INTEGER, height INTEGER, author TEXT, license TEXT, license_url TEXT, page TEXT, source TEXT, by TEXT, at TEXT);
