-- 060: three removed California's Great America coasters, from RCDB via
-- Carter's screenshots, 2026-10-17.
--   Whizzer (1976-1988): Schwarzkopf Jumbo Jet (RCDB: Speed Racer / Extended
--     Jumbo Jet; same model name as Six Flags Great America's Whizzer), 70 ft,
--     42 mph, 3,100 ft, 2:00. First called Willard's Whizzer (1976-80), after
--     Willard Marriott: an alias.
--   Stealth (1 Apr 2000 - 2 Sep 2003): Vekoma Flying Dutchman prototype,
--     115 ft, 51 mph, 2,765.7 ft, 5 inversions, 1:50. RCDB: relocated to
--     Carowinds as Nighthawk, which the site has (#598), so the two are linked
--     as one ride with Nighthawk as home — the relocation rule, as in 049.
--   Gulf Coaster (1976-1980): Allan Herschell Little Dipper kiddie, no stats
--     on RCDB.
-- Inserts are guarded on name + park; the link, alias and activity rows are
-- each no-ops on a second run.

INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Whizzer', 'California''s Great America', 'Steel', 'Schwarzkopf', 'Schwarzkopf Jumbo Jet', 70, 42, 3100, 0, 120, 1, 1976, '1976', 'year', '1988', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'California''s Great America') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Whizzer' AND park = 'California''s Great America');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Stealth', 'California''s Great America', 'Steel', 'Vekoma', 'Vekoma Flying Dutchman', 115, 51, 2765.7, 5, 110, 1, 2000, '2000-04-01', 'day', '2003-09-02', 'day' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'California''s Great America') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Stealth' AND park = 'California''s Great America');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Gulf Coaster', 'California''s Great America', 'Steel', 'Allan Herschell', 'Allan Herschell Little Dipper', NULL, NULL, NULL, 0, NULL, 1, 1976, '1976', 'year', '1980', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'California''s Great America') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Gulf Coaster' AND park = 'California''s Great America');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Willard''s Whizzer', 'rcdb', date('now') FROM coasters WHERE name = 'Whizzer' AND park = 'California''s Great America';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, h.id FROM coasters h, coasters x WHERE h.name = 'Nighthawk' AND h.park = 'Carowinds' AND ((x.name = 'Stealth' AND x.park = 'California''s Great America') OR x.id = h.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'California''s Great America' AND c.name IN ('Whizzer', 'Stealth', 'Gulf Coaster') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'California''s Great America');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '060') FROM coasters h WHERE h.name = 'Nighthawk' AND h.park = 'Carowinds' AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) = 2 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"060"%');
