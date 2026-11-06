-- 155: a new RMC Hybrid at Walibi Belgium, opening 2028, name not announced
-- (Carter, 2026-11-06). Stored as "Unknown", like Magic Mountain's 2028 RMC;
-- rename it through /edit once the name is out. Not linked to Loup-Garou
-- (closing 2027-01-03): an RMC conversion counts as a new credit, as with
-- Steel Vengeance and Mean Streak. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Unknown', 'Walibi Belgium', 'Steel', 'Rocky Mountain Coasters', 'RMC Hybrid', NULL, NULL, NULL, NULL, NULL, 2028, '2028', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Unknown' AND park = 'Walibi Belgium');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Unknown' AND c.park = 'Walibi Belgium' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- Then its stats, from Carter's RCDB screenshot: 4,038.7 ft, 160.8 ft, 65.9 mph
-- (chain lift, dive loop). A fill-in, so no /changes row.
UPDATE coasters SET l = COALESCE(l, 4038.7), h = COALESCE(h, 160.8), s = COALESCE(s, 65.9) WHERE name = 'Unknown' AND park = 'Walibi Belgium';
