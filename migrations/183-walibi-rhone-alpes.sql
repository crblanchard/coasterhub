-- 183: Walibi Rhône-Alpes stats from Carter's RCDB screenshots, 2026-11-18.
-- All five rows already existed, empty; filled in (no activity rows, per
-- Carter 2026-11-05). Former names as plain rcdb aliases. Carter: call the
-- model "Intamin Hot Racer", so Lagoon's J3 Grand Prix (182) moves to it too.
-- Safe to run twice.
UPDATE coasters SET type='Steel', manu='Intamin', model='Intamin Hot Racer', h=59.1, s=41.6, l=2011.2, inv=3, yr=2024, opened='2024-06-15', openedPrec='day' WHERE name='Mahuka' AND park='Walibi Rhône-Alpes';
UPDATE coasters SET model='Intamin Hot Racer' WHERE name='J3 Grand Prix' AND park='Lagoon';
UPDATE coasters SET type='Steel', manu='Zierer', model='Zierer Tivoli', h=26.3, s=22.4, l=1181.1, inv=0, yr=1992, opened='1992', openedPrec='year' WHERE name='Coccinelle' AND park='Walibi Rhône-Alpes';
UPDATE coasters SET type='Steel', manu='Vekoma', model='Vekoma Boomerang', h=116.5, s=47.0, l=935.0, inv=3, dur=108, yr=1988, opened='1988', openedPrec='year' WHERE name='Generator' AND park='Walibi Rhône-Alpes';
UPDATE coasters SET type='Steel', manu='Gerstlauer', model='Gerstlauer Infinity', h=101.7, s=52.8, l=1476.4, inv=3, yr=2019, opened='2019-05-30', openedPrec='day' WHERE name='Mystic' AND park='Walibi Rhône-Alpes';
UPDATE coasters SET type='Wood', manu='Gravitykraft', model='Gravitykraft Wood', h=55.8, s=40.0, l=1464.0, inv=0, yr=2016, opened='2016-04-09', openedPrec='day' WHERE name='Timber' AND park='Walibi Rhône-Alpes';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.n, 'rcdb', date('now') FROM coasters c, (SELECT 'Coccinelle' cn, 'Coccinelle des Andes' n UNION ALL SELECT 'Generator', 'EqWalizer' UNION ALL SELECT 'Generator', 'Boomerang') v WHERE c.park='Walibi Rhône-Alpes' AND c.name=v.cn;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park='Walibi Rhône-Alpes' AND ((c.name='Generator' AND g.name='Vekoma Boomerangs') OR (c.name='Coccinelle' AND g.name='Zierer Tivolis')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster=c.id);
-- Then two more screenshots the same day: Woodstock Express (existing row;
-- Zamperla Zig Zag, 2002; earlier "Zig Zag" then "Scratch") and Le Grand Huit
-- (Pinfari Zyklon Z47, from Walibi Belgium where it was Grand 8, here 1984-1986
-- to 1992; opened by the later year). Sent by Carter, so in despite closing
-- last century. Walibi Belgium's Grand 8 row does not exist yet: noted in
-- missing-parks.md rather than linked.
UPDATE coasters SET type='Steel', manu='Zamperla', model='Zamperla Zig Zag', inv=0, yr=2002, opened='2002', openedPrec='year' WHERE name='Woodstock Express' AND park='Walibi Rhône-Alpes';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT c.id, v.n, 'rcdb', date('now') FROM coasters c, (SELECT 'Scratch' n UNION ALL SELECT 'Zig Zag') v WHERE c.park='Walibi Rhône-Alpes' AND c.name='Woodstock Express';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Le Grand Huit', 'Walibi Rhône-Alpes', 'Steel', 'Pinfari', 'Pinfari Zyklon', NULL, NULL, NULL, 0, NULL, 1986, '1986', 'year', '1992', 'year', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name='Le Grand Huit' AND park='Walibi Rhône-Alpes');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park='Walibi Rhône-Alpes' AND c.name='Le Grand Huit' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind='coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- J3 Grand Prix opens July 2027 (Carter, 2026-11-18).
UPDATE coasters SET opened='2027-07', openedPrec='month' WHERE name='J3 Grand Prix' AND park='Lagoon';
