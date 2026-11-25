-- Dueling Dragons at Guangzhou Sunac Land is two tracks (Carter, 2026-11-25:
-- "has two sides one is inverted one is not"). German Wikipedia: the red track
-- is sit-down (830 m = 2,723 ft), the green one inverted (790 m = 2,592 ft),
-- 56 m (183.7 ft), Intamin, launched, opened 15 June 2019. Two rows named by
-- their sides, per the duelling rule: the existing row (2,591.9 ft: the green
-- track's length, inversions 4) becomes "Dueling Dragons (Green)"; the red one
-- is added (inversions not given per track, so NULL). Matched by name + park.
UPDATE coasters SET name = 'Dueling Dragons (Green)' WHERE park = 'Guangzhou Sunac Land' AND name = 'Dueling Dragons';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', c.name, NULL, json_object('id', c.id, 'from', 'Dueling Dragons', 'park', c.park) FROM coasters c WHERE c.park = 'Guangzhou Sunac Land' AND c.name = 'Dueling Dragons (Green)' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_renamed' AND json_extract(a.detail, '$.id') = c.id AND json_extract(a.detail, '$.from') = 'Dueling Dragons');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Dueling Dragons (Red)', 'Guangzhou Sunac Land', 'Steel', 'Intamin', NULL, 183.7, NULL, 2723.1, NULL, NULL, 2019, '2019-06-15', 'day', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Guangzhou Sunac Land' AND name = 'Dueling Dragons (Red)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Guangzhou Sunac Land' AND c.name = 'Dueling Dragons (Red)' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT c.id, 'dewiki', 'Dueling Dragons', 'approved', '2026-11-25' FROM coasters c WHERE c.park = 'Guangzhou Sunac Land' AND c.name = 'Dueling Dragons (Red)';
