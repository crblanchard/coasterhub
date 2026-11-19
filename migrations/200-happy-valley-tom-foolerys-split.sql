-- Happy Valley and Tom Foolery's are chains (Carter, 2026-11-19: "happy
-- valley is wrong because there are so many locations and tom foolerys has a
-- couple locations"). The New coasters review put every Coasterpedia "Happy
-- Valley" ride at the site's one Happy Valley, and both Tom Foolery's rides at
-- the Wisconsin Dells park.
--
-- The site's "Happy Valley" was pinned at Shenzhen, but its own coasters
-- (Diving Coaster, Mega-Lite, Mine Train Coaster, Family Inverted Coaster) are
-- Happy Valley Shanghai's: Coasterpedia's pages say "Songjiang, Shanghai" and
-- give coordinates there. So it becomes Happy Valley (Shanghai), pinned at
-- Songjiang, and the rest move by each page's location:
--   Shanghai  Coastal Ant, Unnamed Surf Coaster
--   Shenzhen  Coaster Adventures, Power Splash        (the old pin)
--   Tianjin   Crazy Bird, Expedition of Volcano, Mini Coaster
--   Wuhan     Hidden Anaconda
--   Nanjing   Wilderness Escape
-- Pins are the parks' coaster coordinates (Coasterpedia/OSM). Tom Foolery's:
-- Sky Rangers is Wisconsin Dells, Screamin' Centipede is Round Rock, Texas
-- (pin estimated at the Kalahari resort; in missing-parks.md).
-- No former-name alias for the bare names: each is now several parks.
-- Every statement is guarded; a second run does nothing.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Happy Valley (Shanghai)', 6, json_object('from', 'Happy Valley') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Happy Valley') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Happy Valley (Shanghai)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Tom Foolerys Adventure Park (Wisconsin Dells)', 1, json_object('from', 'Tom Foolerys Adventure Park') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Tom Foolerys Adventure Park') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Tom Foolerys Adventure Park (Wisconsin Dells)');

INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES
  ('Happy Valley (Shenzhen)', 22.5446307, 113.9753562, 'China'),
  ('Happy Valley (Tianjin)', 39.18442, 117.47299, 'China'),
  ('Happy Valley (Wuhan)', 30.59586, 114.3892, 'China'),
  ('Happy Valley (Nanjing)', 32.16543, 118.99195, 'China'),
  ('Tom Foolerys Adventure Park (Round Rock)', 30.5606, -97.6087, 'Texas, US')) v
WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);

UPDATE coasters SET park = 'Happy Valley (Shenzhen)' WHERE park = 'Happy Valley' AND name IN ('Coaster Adventures', 'Power Splash');
UPDATE coasters SET park = 'Happy Valley (Tianjin)' WHERE park = 'Happy Valley' AND name IN ('Crazy Bird', 'Expedition of Volcano', 'Mini Coaster');
UPDATE coasters SET park = 'Happy Valley (Wuhan)' WHERE park = 'Happy Valley' AND name = 'Hidden Anaconda';
UPDATE coasters SET park = 'Happy Valley (Nanjing)' WHERE park = 'Happy Valley' AND name = 'Wilderness Escape';
UPDATE coasters SET park = 'Tom Foolerys Adventure Park (Round Rock)' WHERE park = 'Tom Foolerys Adventure Park' AND name = 'Screamin'' Centipede';

UPDATE parks SET name = 'Happy Valley (Shanghai)', lat = 31.09833, lon = 121.21134 WHERE name = 'Happy Valley';
UPDATE coasters SET park = 'Happy Valley (Shanghai)' WHERE park = 'Happy Valley';
UPDATE park_aliases SET park = 'Happy Valley (Shanghai)' WHERE park = 'Happy Valley';
UPDATE parks SET name = 'Tom Foolerys Adventure Park (Wisconsin Dells)' WHERE name = 'Tom Foolerys Adventure Park';
UPDATE coasters SET park = 'Tom Foolerys Adventure Park (Wisconsin Dells)' WHERE park = 'Tom Foolerys Adventure Park';
UPDATE park_aliases SET park = 'Tom Foolerys Adventure Park (Wisconsin Dells)' WHERE park = 'Tom Foolerys Adventure Park';

-- The coaster_added rows from the review point at where each coaster is now.
UPDATE activity SET detail = json_set(detail, '$.park', (SELECT c.park FROM coasters c WHERE c.id = json_extract(activity.detail, '$.id'))) WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') IN ('Happy Valley', 'Tom Foolerys Adventure Park');
