-- 045: relocated rides found by the matching rule (Carter, 2026-10-17: "yes" to
-- linking them). Same manufacturer + model, one row closed and the other opened
-- at a different park within 4 years of that, height and length within 3%.
-- Each set's home is the newest park. Nobody had ridden two rows of any set, so
-- no credit count moves; the coaster pages gain their History lines.
--   Jack Rabbit (Celebration City) -> Viking Voyage (Wild Adventures) -> Hurricane (Fun Spot Kissimmee)
--   Thunderbolt (Celebration City) -> Cliffhanger (Glenwood Caverns)
--   Jet Star (Beech Bend) -> Tig'rr (Indiana Beach)
--   Zoomerang (Alabama Adventure) -> Boomerang (Six Flags St. Louis)
--   Deja Vu (SFMM) -> Goliath (Six Flags New England)
--   Deja Vu (SFOG) -> Aftershock (Silverwood)
--   Alton Mouse (Alton Towers) -> Wild Mouse (Idlewild)
--   Galaxy Spin (Legoland Florida) -> Galaxy Spin (Fun Spot Kissimmee)
-- Ids were read off the live rows the same day (all 17 existed, none linked).
-- The activity row per set is the Worker's same_ride_set shape. Safe to run twice.
INSERT OR IGNORE INTO same_ride (coaster, ride) VALUES (695, 1242), (1778, 1242), (1242, 1242), (697, 80), (80, 80), (1312, 632), (632, 632), (1299, 256), (256, 256), (665, 1134), (1134, 1134), (1263, 819), (819, 819), (1301, 1780), (1780, 1780), (1279, 621), (621, 621);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '045') FROM coasters h WHERE h.id IN (1242, 80, 632, 256, 1134, 819, 1780, 621) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"045"%' AND json_extract(a.detail, '$.ride') = h.id);
