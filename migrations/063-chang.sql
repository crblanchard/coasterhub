-- 063: Chang (Kentucky Kingdom, 4 Apr 1997 - 19 Sep 2009), from RCDB via
-- Carter's screenshot, 2026-10-17. B&M Stand-Up, 154 ft, 63 mph, 4,155 ft,
-- 5 inversions, 2:30. RCDB: relocated to Six Flags Great Adventure as Green
-- Lantern (#71, opened 2011), so it is linked to Green Lantern, home Green
-- Lantern (Carter: "yes it is a relocation"). Guarded on name + park; the
-- link and activity rows are no-ops on a second run.

INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Chang', 'Kentucky Kingdom', 'Steel', 'Bolliger & Mabillard', 'B&M Stand-Up', 154, 63, 4155, 5, 150, 1, 1997, '1997-04-04', 'day', '2009-09-19', 'day' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Chang' AND park = 'Kentucky Kingdom');
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, h.id FROM coasters h, coasters x WHERE h.id = 71 AND h.name = 'Green Lantern' AND h.park = 'Six Flags Great Adventure' AND ((x.name = 'Chang' AND x.park = 'Kentucky Kingdom') OR x.id = h.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Kentucky Kingdom' AND c.name = 'Chang' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Kentucky Kingdom');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '063') FROM coasters h WHERE h.id = 71 AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) = 2 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"063"%');
