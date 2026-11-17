-- 177: Monimo RUSH (Everland) was T Express from opening, 2008-03-14, until
-- 2026-04-26 (Carter, 2026-11-17). Recorded as a dated rename ('renamed',
-- added = the day the name changed), so the coaster page shows the old name's
-- years, plus the coaster_renamed activity row a rename through the Worker
-- would have written. Safe to run twice.
INSERT INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'T Express', 'renamed', '2026-04-26' FROM coasters WHERE name = 'Monimo RUSH' AND park = 'Everland' ON CONFLICT(coaster_id, former_name) DO UPDATE SET note = 'renamed', added = excluded.added;
INSERT INTO activity (at, actor, kind, subject, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Monimo RUSH', json_object('id', id, 'from', 'T Express', 'park', 'Everland', 'on', '2026-04-26') FROM coasters WHERE name = 'Monimo RUSH' AND park = 'Everland' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'coaster_renamed' AND json_extract(detail, '$.from') = 'T Express' AND json_extract(detail, '$.park') = 'Everland');
