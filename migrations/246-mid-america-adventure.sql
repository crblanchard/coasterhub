-- Six Flags St. Louis is now Mid America Adventure (Carter, 2026-11-25: "rename
-- six flags st louis Mid America Adventure"). Same steps as 229: the park row,
-- its 11 coasters, the old name kept as a former name (old links, imports and
-- its photos still find it), activity details re-pointed, a park_renamed row
-- for /changes. Each step is a no-op on a second run.
UPDATE parks SET name = 'Mid America Adventure' WHERE name = 'Six Flags St. Louis' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Mid America Adventure');
UPDATE coasters SET park = 'Mid America Adventure' WHERE park = 'Six Flags St. Louis';
UPDATE park_aliases SET park = 'Mid America Adventure' WHERE park = 'Six Flags St. Louis';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) VALUES ('Mid America Adventure', 'Six Flags St. Louis', 'rename', date('now'));
UPDATE activity SET detail = json_set(detail, '$.park', 'Mid America Adventure') WHERE json_extract(detail, '$.park') = 'Six Flags St. Louis';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Mid America Adventure', (SELECT COUNT(*) FROM coasters WHERE park = 'Mid America Adventure'), json_object('from', 'Six Flags St. Louis') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Mid America Adventure') AND NOT EXISTS (SELECT 1 FROM activity WHERE kind = 'park_renamed' AND subject = 'Mid America Adventure');
