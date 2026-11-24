-- 234: Sea Lion Park was at Coney Island, New York (Carter, 2026-11-24: "sea
-- lion park was in new york ... coney island"). The site had it twice: "Sea
-- Lion Park" in Illinois (wrong) and "Paul Boyton's Sea Lion Park" in New York
-- pinned mid-Brooklyn, each with a Flip Flap Railway (1895-1902), no riders.
-- One park stays, named "Sea Lion Park", with the other name as a former name,
-- pinned at Coney Island on the site Luna Park later took.
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT 3773, source, ref, method, added FROM open_links WHERE coaster_id = 3853 AND EXISTS (SELECT 1 FROM coasters WHERE id = 3773);
DELETE FROM open_links WHERE coaster_id = 3853;
DELETE FROM open_facts WHERE coaster_id = 3853;
DELETE FROM coaster_sources WHERE coaster_id = 3853;
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') = 3853;
DELETE FROM coasters WHERE id = 3853 AND park = 'Sea Lion Park' AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL) AND id NOT IN (SELECT coaster_id FROM rankings);
DELETE FROM parks WHERE name = 'Sea Lion Park' AND region = 'Illinois, US' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Sea Lion Park');
UPDATE parks SET name = 'Sea Lion Park', lat = 40.5753, lon = -73.9797 WHERE name = 'Paul Boyton''s Sea Lion Park' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Sea Lion Park');
UPDATE coasters SET park = 'Sea Lion Park' WHERE park = 'Paul Boyton''s Sea Lion Park';
UPDATE activity SET detail = json_set(detail, '$.park', 'Sea Lion Park') WHERE json_extract(detail, '$.park') = 'Paul Boyton''s Sea Lion Park';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) VALUES ('Sea Lion Park', 'Paul Boyton''s Sea Lion Park', 'alias', date('now'));
