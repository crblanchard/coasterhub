-- 081: the rest of Gardaland, from RCDB via Carter's screenshots, 2026-10-29.
-- Stats for three bare rows:
--   Ortobruco Tour: Pinfari family coaster, no stats on RCDB, operating since
--     1990 or earlier (stored as 1990, year).
--   Raptor: B&M Wing, 108.3 ft, 55.9 mph, 2,526.3 ft, 3 inv, 1:30, since
--     1 Apr 2011.
--   Shaman: Vekoma MK-1200 double loop corkscrew (the site's Vekoma Looper),
--     98.4 ft, 43.5 mph, 2,460.6 ft, 4 inv, 2:00, since 1985.
-- And three removed ones, new:
--   Sequoia Magic Loop: S&S Screaming Squirrel, 98.4 ft, 3 inv, 1:25,
--     30 Apr 2005 - 2021; Sequoia Adventure until 2018 (alias).
--   Zyklon: Schwarzkopf City Jet (a small Jet Star), 1982-91, no stats. Not
--     in the Jet Stars category (a different, smaller model).
--   Prezzemolo Tour: Zamperla Powered (single helix), 1986-89, no stats.
-- Fuga Da Atlantide is still bare. Guarded, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 5, json_object('id', id, 'fields', json_array('manu', 'inv', 'yr', 'opened', 'openedPrec'), 'via', '081') FROM coasters WHERE name = 'Ortobruco Tour' AND park = 'Gardaland' AND manu IS NULL;
UPDATE coasters SET manu = 'Pinfari', inv = 0, yr = 1990, opened = '1990', openedPrec = 'year' WHERE name = 'Ortobruco Tour' AND park = 'Gardaland' AND manu IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '081') FROM coasters WHERE name = 'Raptor' AND park = 'Gardaland' AND manu IS NULL;
UPDATE coasters SET manu = 'Bolliger & Mabillard', model = 'B&M Wing', h = 108.3, s = 55.9, l = 2526.3, inv = 3, dur = 90, yr = 2011, opened = '2011-04-01', openedPrec = 'day' WHERE name = 'Raptor' AND park = 'Gardaland' AND manu IS NULL;
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 10, json_object('id', id, 'fields', json_array('manu', 'model', 'h', 's', 'l', 'inv', 'dur', 'yr', 'opened', 'openedPrec'), 'via', '081') FROM coasters WHERE name = 'Shaman' AND park = 'Gardaland' AND manu IS NULL;
UPDATE coasters SET manu = 'Vekoma', model = 'Vekoma Looper', h = 98.4, s = 43.5, l = 2460.6, inv = 4, dur = 120, yr = 1985, opened = '1985', openedPrec = 'year' WHERE name = 'Shaman' AND park = 'Gardaland' AND manu IS NULL;
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Sequoia Magic Loop', 'Gardaland', 'Steel', 'S&S Worldwide', 'S&S Screaming Squirrel', 98.4, NULL, NULL, 3, 85, 1, 2005, '2005-04-30', 'day', '2021', 'year' WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Sequoia Magic Loop' AND park = 'Gardaland');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Zyklon', 'Gardaland', 'Steel', 'Schwarzkopf', 'Schwarzkopf City Jet', NULL, NULL, NULL, 0, NULL, 1, 1982, '1982', 'year', '1991', 'year' WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Zyklon' AND park = 'Gardaland');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Prezzemolo Tour', 'Gardaland', 'Steel', 'Zamperla', 'Zamperla Powered', NULL, NULL, NULL, 0, NULL, 1, 1986, '1986', 'year', '1989', 'year' WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Prezzemolo Tour' AND park = 'Gardaland');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Sequoia Adventure', 'rcdb', date('now') FROM coasters WHERE name = 'Sequoia Magic Loop' AND park = 'Gardaland';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Gardaland' AND c.name IN ('Sequoia Magic Loop', 'Zyklon', 'Prezzemolo Tour') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
