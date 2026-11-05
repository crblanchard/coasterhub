-- 144: a "Go Gators" category (Carter, 2026-11-05: "Make Go Gators a category").
-- The four Wisdom Rides Go Gators in the database, matched by name: Butler
-- Amusements' Go Gator (no maker on our row; gets Wisdom Rides, like the
-- others), Coney Beach Porthcawl's and Kiwanis Kiddieland's Go-Gator, and
-- Funland at the Tropicana's Go Gator. All four get model "Wisdom Go Gator".
-- Edits are logged first and only fill empty fields. Safe to run twice.
INSERT INTO clone_groups (name, note, created) SELECT 'Go Gators', NULL, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Go Gators');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 1, json_object('id', id, 'fields', json_array('model'), 'via', '144') FROM coasters WHERE REPLACE(name, '-', ' ') = 'Go Gator' AND model IS NULL;
UPDATE coasters SET manu = COALESCE(manu, 'Wisdom Rides'), model = 'Wisdom Go Gator' WHERE REPLACE(name, '-', ' ') = 'Go Gator' AND model IS NULL;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE REPLACE(c.name, '-', ' ') = 'Go Gator' AND g.name = 'Go Gators' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 1, 'via', '144') FROM clone_groups g WHERE g.name = 'Go Gators' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name);
