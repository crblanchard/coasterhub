-- Venice Pier, take two (Carter, 2026-11-20: "put it where it actually was").
-- Its coaster, Race Thru the Clouds (1911-1923), stood on Abbot Kinney's pier
-- at the foot of Windward Avenue, not on today's fishing pier at Washington
-- Boulevard (205). The Windward Piers historical marker is at the landward
-- end (33.9862, -118.4738); the pier ran about 400 m out to the south-west,
-- so its middle is about 33.9853, -118.4756. Replaces 205's pin.
UPDATE parks SET lat = 33.9853, lon = -118.4756 WHERE name = 'Venice Pier';
