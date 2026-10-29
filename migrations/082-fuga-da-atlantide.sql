-- 082: Fuga da Atlantide (Gardaland), from RCDB via Carter's screenshot,
-- 2026-10-29. Intamin Super Splash (a shoot-the-chute that RCDB lists, so it
-- counts — Carter: "yes count it"), 299 m = 981 ft, 75 km/h = 46.6 mph,
-- since 2003. Logged by atcarroll99 and maxg. Guarded on the row still having
-- no maker, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 8, json_object('id', id, 'fields', json_array('manu', 'model', 's', 'l', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '082') FROM coasters WHERE name = 'Fuga Da Atlantide' AND park = 'Gardaland' AND manu IS NULL;
UPDATE coasters SET manu = 'Intamin', model = 'Intamin Super Splash', s = 46.6, l = 981, inv = 0, yr = 2003, opened = '2003', openedPrec = 'year' WHERE name = 'Fuga Da Atlantide' AND park = 'Gardaland' AND manu IS NULL;
