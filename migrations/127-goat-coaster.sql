-- 127: Goat Coaster (Goats on the Roof of the Smokies) had no details at all — it
-- came in with the original bulk import. Carter, 2026-11-03: opened 2015, Wiegand
-- Alpine, 3,061 ft. Logged first (it matches on manu IS NULL), so a second run
-- changes and logs nothing.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 4, json_object('id', id, 'fields', json_array('manu', 'model', 'l', 'yr'), 'via', '127') FROM coasters WHERE name = 'Goat Coaster' AND park = 'Goats on the Roof of the Smokies' AND manu IS NULL;
UPDATE coasters SET manu = 'Wiegand', model = 'Wiegand Alpine', l = 3061.0, yr = 2015, opened = '2015', openedPrec = 'year' WHERE name = 'Goat Coaster' AND park = 'Goats on the Roof of the Smokies' AND manu IS NULL;
