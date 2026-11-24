-- 229: Southport Pleasureland was renamed Adventure Coast Southport in
-- February 2025 (Wikipedia); Carter, 2026-11-24: "yes rename the park that
-- was renamed". Same steps as 036's Rowdy Bear's rename; the old name stays
-- as a former name so imports and the weekly refresh still find it.
UPDATE parks SET name = 'Adventure Coast Southport' WHERE name = 'Southport Pleasureland' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Adventure Coast Southport');
UPDATE coasters SET park = 'Adventure Coast Southport' WHERE park = 'Southport Pleasureland';
UPDATE park_aliases SET park = 'Adventure Coast Southport' WHERE park = 'Southport Pleasureland';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) VALUES ('Adventure Coast Southport', 'Southport Pleasureland', 'rename', date('now'));
UPDATE activity SET detail = json_set(detail, '$.park', 'Adventure Coast Southport') WHERE json_extract(detail, '$.park') = 'Southport Pleasureland';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Adventure Coast Southport', (SELECT COUNT(*) FROM coasters WHERE park = 'Adventure Coast Southport'), json_object('from', 'Southport Pleasureland') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Adventure Coast Southport') AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'park_renamed' AND subject = 'Adventure Coast Southport');
-- On the live run "Adventure Coast Southport" already existed (with Odin's
-- Little Dragon Coaster and its own pin), so this was a merge: Indy's Lost
-- World moved over and the empty old park row goes.
DELETE FROM parks WHERE name = 'Southport Pleasureland' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Southport Pleasureland') AND EXISTS (SELECT 1 FROM parks WHERE name = 'Adventure Coast Southport');
