-- 150: Carter, 2026-11-05: "all three RES rides are Roller Balls." Wiener
-- Prater's Roller Ball gets the model the other RES rows have, and the three
-- rides (Adventureland NY's Fireball, Wiener Prater's Roller Ball, and Wilde
-- Hilde — one ride, at Schwaben Park then Geiselwind, so one credit) become a
-- "RES Roller Balls" category. Safe to run twice.
UPDATE coasters SET model = 'RES Roller Ball' WHERE manu = 'RES Rides' AND model IS NULL;
INSERT INTO clone_groups (name, note, created) SELECT 'RES Roller Balls', NULL, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'RES Roller Balls');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.manu = 'RES Rides' AND g.name = 'RES Roller Balls' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 1, 'via', '150') FROM clone_groups g WHERE g.name = 'RES Roller Balls' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name);
