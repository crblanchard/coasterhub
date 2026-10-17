-- 056: Tidal Twister (SeaWorld San Diego), from RCDB via Carter's screenshot,
-- 2026-10-17. It had no stats, maker or dates. RCDB: Skyline Attractions
-- Skywarp (same model name the site already uses for Harley Quinn Crazy
-- Coaster), 22 ft, 30 mph, 320 ft, one inversion; operated 24 May 2019 to
-- July 2023 (its SBNO months after are not recorded — Carter: no SBNO info).
-- Activity is the Worker's coaster_edited shape; both statements are guarded
-- on the row still having no maker, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', c.name, 11, json_object('id', c.id, 'fields', json_array('manu','model','h','s','l','inv','yr','opened','openedPrec','closed','closedPrec'), 'via', '056')
  FROM coasters c WHERE c.name = 'Tidal Twister' AND c.park = 'SeaWorld San Diego' AND c.manu IS NULL;
UPDATE coasters SET manu = 'Skyline Attractions', model = 'Skyline Skywarp', h = 22, s = 30, l = 320, inv = 1, yr = 2019, opened = '2019-05-24', openedPrec = 'day', closed = '2023-07', closedPrec = 'month' WHERE name = 'Tidal Twister' AND park = 'SeaWorld San Diego' AND manu IS NULL;
