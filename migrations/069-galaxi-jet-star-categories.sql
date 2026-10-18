-- 069: two new categories, Carter 2026-10-18 ("Sounds good" to the offer).
--   SDC Galaxis: every row the site models as SDC Galaxi — Olympic Bobsleds
--     (Helm & Sons), Super Screamer (Adventureland Iowa), Galaxi (Adventureland
--     NY), Galaxi (Cliff's), and the four stops of the travelling Galaxi
--     (Noble Park, LeSourdsville, Fun Way, Niagara; one ride via same_ride).
--   Schwarzkopf Jet Stars: every row modelled Schwarzkopf Jet Star — Tig'rr,
--     Black Hole (Alton Towers), Cannonball Express (Pleasurewood Hills) and
--     the five stops of the Beech Bend Jet Star (one ride via same_ride).
-- Left out on purpose: Lagoon's Jet Star 2 (a Jet Star 2, the bigger
-- model), and the two French fair Jet Stars, whose model is not on file.
-- Members are picked by model, as the categories are defined; relocated stops
-- are all members, as with Vampire in Vekoma Boomerangs (062).
-- The Worker's clone_set {made: true} row records each creation (hidden from
-- the feed, like every clone_set). Guarded on the group name, so a second run
-- is a no-op.

INSERT INTO clone_groups (name, note, created) SELECT 'SDC Galaxis', NULL, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'SDC Galaxis');
INSERT INTO clone_groups (name, note, created) SELECT 'Schwarzkopf Jet Stars', NULL, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM clone_groups WHERE name = 'Schwarzkopf Jet Stars');
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'SDC Galaxis' AND c.model = 'SDC Galaxi';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE g.name = 'Schwarzkopf Jet Stars' AND c.model = 'Schwarzkopf Jet Star';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', json('true'), 'via', '069') FROM clone_groups g WHERE g.name IN ('SDC Galaxis', 'Schwarzkopf Jet Stars') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"069"%');
