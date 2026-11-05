-- 147: Toverland's Wilde Maus (MACK Wilde Maus Compact Mobile, 2004-07-03 to
-- 2004-08-02 — a stand-in while Booster Bike ran late), from Carter's RCDB
-- screenshot, 2026-11-05. Its other homes — Walygator Grand Est (as Zig Zag;
-- the park is here, but no dates for that stop), Sommerland Syd and Freizeit-Land
-- Geiselwind — are not linked; see missing-parks.md. Safe to run twice.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Wilde Maus', 'Toverland', 'Steel', 'MACK Rides', 'MACK Wild Mouse', 45.9, 28.0, 1213.9, 0, 110, 2004, '2004-07-03', 'day', '2004-08-02', 'day', 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wilde Maus' AND park = 'Toverland');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Wilde Maus' AND c.park = 'Toverland' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
