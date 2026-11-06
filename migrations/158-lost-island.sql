-- 158: Lost Island Theme Park (Waterloo IA), from Carter's RCDB screenshots and
-- coordinates, 2026-11-06. Fill-ins (no /changes rows):
--   Fire Runner: RMC Raptor (Stunt Pilot), 92 ft, 52 mph, 1,950 ft, 3 inv,
--     2025-07-18. Lokolo: SBF Visa MX48, 12.5 ft, 452.8 ft, 2022-06-18.
--   Matugani: opened here 2023-05-20 (already linked to Liseberg's Kanonen).
--   Nopuku: Vekoma SLC 765m w/helix, 109.3 ft, 49.7 mph, 2,509.8 ft, 5 inv,
--     1:30, 2022-06-18, into Vekoma SLCs; RCDB's "Nopuku Air Coaster" kept as a
--     former name so it is found by that too. Its first home, Ratanga Junction
--     (as Cobra), is not in the database.
-- New: Forbidden Lair, RMC "Wild Moose" (a new model, per Carter: "RMC Wild
--   Moose is a new model please"), shuttle family coaster, 79 ft, 38 mph,
--   910 ft, opening 2027.
-- The park pin moves to Carter's coordinates. Safe to run twice.
UPDATE parks SET lat = 42.442237, lon = -92.305303 WHERE name = 'Lost Island Theme Park';
UPDATE coasters SET manu = COALESCE(manu, 'Rocky Mountain Coasters'), model = COALESCE(model, 'RMC Raptor'), h = COALESCE(h, 92.0), s = COALESCE(s, 52.0), l = COALESCE(l, 1950.0), inv = COALESCE(inv, 3), yr = COALESCE(yr, 2025), opened = COALESCE(opened, '2025-07-18'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Lost Island Theme Park' AND name = 'Fire Runner';
UPDATE coasters SET manu = COALESCE(manu, 'SBF Visa'), model = COALESCE(model, 'SBF Visa Family Coaster'), h = COALESCE(h, 12.5), l = COALESCE(l, 452.8), inv = COALESCE(inv, 0), yr = COALESCE(yr, 2022), opened = COALESCE(opened, '2022-06-18'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Lost Island Theme Park' AND name = 'Lokolo';
UPDATE coasters SET yr = COALESCE(yr, 2023), opened = COALESCE(opened, '2023-05-20'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Lost Island Theme Park' AND name = 'Matugani';
UPDATE coasters SET manu = COALESCE(manu, 'Vekoma'), model = COALESCE(model, 'Vekoma Suspended Looping Coaster'), h = COALESCE(h, 109.3), s = COALESCE(s, 49.7), l = COALESCE(l, 2509.8), inv = COALESCE(inv, 5), dur = COALESCE(dur, 90), yr = COALESCE(yr, 2022), opened = COALESCE(opened, '2022-06-18'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Lost Island Theme Park' AND name = 'Nopuku';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Nopuku Air Coaster', 'rcdb', date('now') FROM coasters WHERE park = 'Lost Island Theme Park' AND name = 'Nopuku';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Lost Island Theme Park' AND c.name = 'Nopuku' AND g.name = 'Vekoma SLCs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Forbidden Lair', 'Lost Island Theme Park', 'Steel', 'Rocky Mountain Coasters', 'RMC Wild Moose', 79.0, 38.0, 910.0, 0, NULL, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Forbidden Lair' AND park = 'Lost Island Theme Park');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Forbidden Lair' AND c.park = 'Lost Island Theme Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
