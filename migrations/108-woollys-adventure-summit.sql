-- 108: Woolly's Adventure Summit (Mammoth Lakes, CA), a new park, and its
-- Mountain Coaster: Wiegand alpine coaster, 1,663 m (5,456 ft), opened 2023
-- (Carter, 2026-10-31, with coords and a listing screenshot). Model as the
-- site's other Wiegand alpines. Safe to run twice.
INSERT INTO parks (name, lat, lon, region) SELECT 'Woolly''s Adventure Summit', 37.6512, -119.0077, 'California, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Woolly''s Adventure Summit');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mountain Coaster', 'Woolly''s Adventure Summit', 'Steel', 'Wiegand', 'Wiegand Alpine', NULL, NULL, 5456.0, 0, NULL, 2023, '2023', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mountain Coaster' AND park = 'Woolly''s Adventure Summit');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Mountain Coaster' AND c.park = 'Woolly''s Adventure Summit' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
