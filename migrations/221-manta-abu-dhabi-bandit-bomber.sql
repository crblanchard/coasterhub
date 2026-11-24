-- 221: two coasters wrongly rejected in /sources/review, added back (Carter,
-- 2026-11-24: "yes definitely for both"). Both were suggested "@ Ferrari
-- World", which is why they looked wrong. From Coasterpedia (metric there):
--   Manta, SeaWorld Abu Dhabi: Intamin LSM launch coaster, 4 inversions,
--     opened 2023-05-23. No height or length given; left NULL.
--   Bandit Bomber, Yas Waterworld (new park): Vekoma "Splash Party", a
--     suspended family coaster with water effects; 23 m = 75.5 ft,
--     515 m = 1,689.6 ft, 50 km/h = 31.1 mph, opened 2013-01-20. No model
--     string fits, so model NULL.
-- Yas Waterworld's pin is the ride's own coordinates (it stands in the park).
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Yas Waterworld', 24.4869, 54.5997, 'United Arab Emirates', 0
WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Yas Waterworld');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps)
SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
  ('Manta', 'SeaWorld Abu Dhabi', 'Steel', 'Intamin', 'Intamin Launch', NULL, NULL, NULL, 4, NULL, 2023, '2023-05-23', 'day', NULL, NULL, 1),
  ('Bandit Bomber', 'Yas Waterworld', 'Steel', 'Vekoma', NULL, 75.5, 31.1, 1689.6, 0, NULL, 2013, '2013-01-20', 'day', NULL, NULL, 1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE ((c.name = 'Manta' AND c.park = 'SeaWorld Abu Dhabi') OR (c.name = 'Bandit Bomber' AND c.park = 'Yas Waterworld')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
UPDATE open_reviews SET kind = 'match', decision = 'approve', note = 'restored (221)', coaster_id = (SELECT id FROM coasters WHERE name = 'Manta' AND park = 'SeaWorld Abu Dhabi') WHERE kind = 'add' AND decision = 'reject' AND ref = 'Manta (SeaWorld Abu Dhabi)';
UPDATE open_reviews SET kind = 'match', decision = 'approve', note = 'restored (221)', coaster_id = (SELECT id FROM coasters WHERE name = 'Bandit Bomber' AND park = 'Yas Waterworld') WHERE kind = 'add' AND decision = 'reject' AND ref = 'Bandit Bomber';
