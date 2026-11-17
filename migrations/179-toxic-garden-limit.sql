-- 179: Toxic Garden (Heide Park Resort) was Limit from opening in 1999 until
-- 2022 (Carter, 2026-11-17). A dated rename known to the year: added = '2022'
-- (app.js formerNamesDated prints a bare year as is), plus the
-- coaster_renamed activity row. Safe to run twice.
INSERT INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Limit', 'renamed', '2022' FROM coasters WHERE name = 'Toxic Garden' AND park = 'Heide Park Resort' ON CONFLICT(coaster_id, former_name) DO UPDATE SET note = 'renamed', added = excluded.added;
INSERT INTO activity (at, actor, kind, subject, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Toxic Garden', json_object('id', id, 'from', 'Limit', 'park', 'Heide Park Resort', 'on', '2022') FROM coasters WHERE name = 'Toxic Garden' AND park = 'Heide Park Resort' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_renamed' AND json_extract(detail, '$.from') = 'Limit' AND json_extract(detail, '$.park') = 'Heide Park Resort');
