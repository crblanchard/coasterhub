-- 152: BonBon-Land (Denmark), from Carter's RCDB screenshots, 2026-11-05.
-- Stat fill-ins (no /changes rows): Han-Katten (Gerstlauer spinner 380/4,
-- 52.5 ft, 34.2 mph, 1,302.5 ft, 1:00, 2007-07-07), Hundeprutten (Zierer Force
-- One, 14.8 ft, 18.6 mph, 413.4 ft, 1993), Viktor Vandorm (custom Zierer Tivoli,
-- 45.9 ft, 32.9 mph, 2,460.7 ft, 2009-04-09; earlier at Panorama Park Sauerland
-- as Flinker Fridolin, a park we don't have), Vild-Svinet (Euro-Fighter 500/8,
-- 72 ft, 45 mph, 1,404 ft, 1 inv, 1:00, 2003-05-16). New: Hvin & Hyl Rutsch
-- (Sunkid Butterfly, 20 ft, 1993 to 2007/2008 — stored closed 2008 by year).
UPDATE coasters SET h = COALESCE(h, 52.5), s = COALESCE(s, 34.2), l = COALESCE(l, 1302.5), inv = COALESCE(inv, 0), dur = COALESCE(dur, 60), yr = COALESCE(yr, 2007), opened = COALESCE(opened, '2007-07-07'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'BonBon-Land' AND name = 'Han-Katten';
UPDATE coasters SET manu = COALESCE(manu, 'Zierer'), model = COALESCE(model, 'Zierer Force'), h = COALESCE(h, 14.8), s = COALESCE(s, 18.6), l = COALESCE(l, 413.4), inv = COALESCE(inv, 0), yr = COALESCE(yr, 1993), opened = COALESCE(opened, '1993'), openedPrec = COALESCE(openedPrec, 'year') WHERE park = 'BonBon-Land' AND name = 'Hundeprutten';
UPDATE coasters SET h = COALESCE(h, 45.9), s = COALESCE(s, 32.9), l = COALESCE(l, 2460.7), inv = COALESCE(inv, 0), yr = COALESCE(yr, 2009), opened = COALESCE(opened, '2009-04-09'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'BonBon-Land' AND name = 'Viktor Vandorm';
UPDATE coasters SET h = COALESCE(h, 72.0), s = COALESCE(s, 45.0), l = COALESCE(l, 1404.0), inv = COALESCE(inv, 1), dur = COALESCE(dur, 60), yr = COALESCE(yr, 2003), opened = COALESCE(opened, '2003-05-16'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'BonBon-Land' AND name = 'Vild-Svinet';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Hvin & Hyl Rutsch', 'BonBon-Land', 'Steel', 'Sunkid', 'Sunkid Butterfly', 20.0, NULL, NULL, 0, NULL, 1993, '1993', 'year', '2008-06-01', 'year', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Hvin & Hyl Rutsch' AND park = 'BonBon-Land');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Hvin & Hyl Rutsch' AND c.park = 'BonBon-Land' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
