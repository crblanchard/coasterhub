-- CJ Barrymore's loop coaster closed in October 2025 and is being moved to
-- Swampy Jack's Wongo Adventure (Carter, 2026-11-25), where Coasterpedia
-- already lists it "in storage" (row "Loop Coaster (Swampy Jack's Wongo)").
-- And CJ Barrymore's has a new SBF Visa coaster, "The Coaster", opened July
-- 2026 (Carter's Coasterpedia screenshot: Cyclon Coaster, Zyklon 40m layout,
-- chain lift, 0 inversions, 4 riders a train).
--  * CJ's "Loop Roller Coaster": closed 2025-10; maker Pinfari (its model is
--    already Pinfari Zyklon).
--  * Swampy Jack's row: named plain "Loop Coaster" (the park was in its name
--    from the source title) and marked opening soon (no year yet).
--  * Linked as one ride (same_ride), home = the Swampy Jack's row (the latest
--    one; a future row counts). Re-run 223 after for the blank stats.
--  * The Coaster added; model "SBF Visa Cyclon Coaster" (the maker's prefix
--    plus Coasterpedia's product, the form every model takes since 230).
UPDATE coasters SET closed = '2025-10', closedPrec = 'month', manu = COALESCE(manu, 'Pinfari') WHERE park = 'CJ Barrymore''s' AND name = 'Loop Roller Coaster' AND closed IS NULL;
UPDATE coasters SET name = 'Loop Coaster', openedPrec = 'soon' WHERE park = 'Swampy Jack''s Wongo Adventure' AND name = 'Loop Coaster (Swampy Jack''s Wongo)';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', c.name, NULL, json_object('id', c.id, 'from', 'Loop Coaster (Swampy Jack''s Wongo)', 'park', c.park) FROM coasters c WHERE c.park = 'Swampy Jack''s Wongo Adventure' AND c.name = 'Loop Coaster' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_renamed' AND json_extract(a.detail, '$.id') = c.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.park = 'Swampy Jack''s Wongo Adventure' AND h.name = 'Loop Coaster' AND (c.id = h.id OR (c.park = 'CJ Barrymore''s' AND c.name = 'Loop Roller Coaster'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '247') FROM coasters h WHERE h.park = 'Swampy Jack''s Wongo Adventure' AND h.name = 'Loop Coaster' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"247"%');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'The Coaster', 'CJ Barrymore''s', 'Steel', 'SBF Visa', 'SBF Visa Cyclon Coaster', NULL, NULL, NULL, 0, NULL, 2026, '2026-07', 'month', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'CJ Barrymore''s' AND name = 'The Coaster');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'CJ Barrymore''s' AND c.name = 'The Coaster' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- 223's job for this one pair, by hand: the CJ row's blank stats from the
-- Swampy Jack's row (same track).
UPDATE coasters SET h = COALESCE(h, 36.1), l = COALESCE(l, 1197.5), inv = COALESCE(inv, 1) WHERE park = 'CJ Barrymore''s' AND name = 'Loop Roller Coaster';
