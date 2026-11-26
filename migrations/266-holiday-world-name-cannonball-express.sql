-- Carter, 2026-11-26, after Cannonball! slipped past the matcher:
-- 1. Holiday World takes its full name, "Holiday World & Splashin' Safari"
--    (as Coasterpedia and the park write it). The old name stays a former
--    name (note 'rcdb': the park was not renamed today), so old links, trips,
--    imports and its photos still find it. Same steps as 246.
-- 2. Cannonball Express at Pleasurewood Hills closed in 2025 (Coasterpedia).
UPDATE parks SET name = 'Holiday World & Splashin'' Safari' WHERE name = 'Holiday World' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Holiday World & Splashin'' Safari');
UPDATE coasters SET park = 'Holiday World & Splashin'' Safari' WHERE park = 'Holiday World';
UPDATE park_aliases SET park = 'Holiday World & Splashin'' Safari' WHERE park = 'Holiday World';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) VALUES ('Holiday World & Splashin'' Safari', 'Holiday World', 'rcdb', date('now'));
UPDATE activity SET detail = json_set(detail, '$.park', 'Holiday World & Splashin'' Safari') WHERE json_extract(detail, '$.park') = 'Holiday World';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Holiday World & Splashin'' Safari', (SELECT COUNT(*) FROM coasters WHERE park = 'Holiday World & Splashin'' Safari'), json_object('from', 'Holiday World') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Holiday World & Splashin'' Safari') AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'park_renamed' AND subject = 'Holiday World & Splashin'' Safari');
UPDATE park_photo_pick SET park = 'Holiday World & Splashin'' Safari' WHERE park = 'Holiday World';
UPDATE coasters SET closed = '2025', closedPrec = 'year' WHERE name = 'Cannonball Express' AND park = 'Pleasurewood Hills' AND closed IS NULL;
