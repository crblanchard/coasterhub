-- 227 (Carter, 2026-11-24).
-- 1. Cedar Point's two Wild Mice: "there's a wild mouse that opened in 2023ish
--    that's still open and the old one ... want them separate. if there's
--    only one on the site use the stats and everything for the 2023 one".
--    Row 386 (14 rides, 6 rankings: people rode the new one) becomes the 2023
--    Zamperla (Twister Coaster Freeform, stored as Zamperla Spinner): 52 ft,
--    35 mph, 1,312 ft, opened 2023-05-06, per Coasterpedia. The 1959 B. A.
--    Schiff ride is added as "Wild Mouse (Old)" (the older of two same-named
--    rides gets " (Old)"), 1,300 ft, 1:20, opened 1959-05-30, closed 1963.
--    The Coasterpedia links move to match.
UPDATE coasters SET manu = 'Zamperla', model = 'Zamperla Spinner', h = 52, s = 35, l = 1312, inv = 0, dur = NULL, yr = 2023, opened = '2023-05-06', openedPrec = 'day', closed = NULL, closedPrec = NULL WHERE id = 386 AND name = 'Wild Mouse' AND park = 'Cedar Point';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps)
SELECT (SELECT MAX(id) FROM coasters) + 1, 'Wild Mouse (Old)', 'Cedar Point', 'Steel', 'B. A. Schiff & Associates', 'Schiff Wild Mouse', NULL, NULL, 1300, 0, 80, 1959, '1959-05-30', 'day', '1963', 'year', 1
WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Wild Mouse (Old)' AND park = 'Cedar Point');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Wild Mouse (Old)' AND c.park = 'Cedar Point' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
DELETE FROM open_facts WHERE coaster_id = 386 AND ref = 'Wild Mouse (Cedar Point; opened 1959)';
UPDATE open_links SET coaster_id = (SELECT id FROM coasters WHERE name = 'Wild Mouse (Old)' AND park = 'Cedar Point') WHERE ref = 'Wild Mouse (Cedar Point; opened 1959)' AND coaster_id = 386;
DELETE FROM coaster_sources WHERE coaster_id = 386;
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) VALUES (386, 'coasterpedia', 'Wild Mouse (Cedar Point; opened 2023)', 'approved', '2026-11-24');
-- 2. Wiegand "Summer Toboggan Run" rides are trough slides ("yes delete the
--    summer toboggan runs"). 27, none ridden or ranked; same steps as 213/218,
--    and the parks left empty go too.
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', l.source, l.ref, 0, 'reject', 'summer toboggan run (227)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links l WHERE l.coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_facts WHERE coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM open_choices WHERE coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM coaster_aliases WHERE coaster_id IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM clone_members WHERE coaster IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM same_ride WHERE coaster IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (SELECT id FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS _gone_parks (name TEXT PRIMARY KEY);
INSERT OR IGNORE INTO _gone_parks SELECT DISTINCT park FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM coasters WHERE id IN (3909,2850,2882,2820,2968,2705,2918,2896,2990,3009,2789,3088,2851,2664,2750,3045,3576,4040,2906,2961,2977,3012,3021,3025,3277,3049,3950) AND id NOT IN (SELECT coaster_id FROM rankings) AND id NOT IN (SELECT coaster_id FROM rides WHERE coaster_id IS NOT NULL);
DELETE FROM parks WHERE name IN (SELECT name FROM _gone_parks) AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
DROP TABLE IF EXISTS _gone_parks;
-- The parks those took with them are marked rejected in the review, so the
-- weekly refresh does not offer them as new parks.
UPDATE open_reviews SET decision = 'reject', note = note || ' (summer toboggan run, 227)' WHERE kind = 'park' AND decision = 'approve' AND note IN ('Thredbo Alpine Resort','Funfields Themepark','Jungle Park','Cool Runnings Toboggan Family Park','Plymouth Snowsports Centre','Panorama Park','Maniototo Adventure Park','Lac de Caniel','Semnoz','Super Besse','Attractiepark Kabelbaan Valkenburg','Garmisch-Partenkirchen','Jagdmärchenpark Hirschalm','Tolk-Schau','Watermouth Castle','Duporth Holiday Resort','Ebbw Vale Garden Festival','Llandudno Snowsports Centre','Pembrey Country Park & Beach','Robin Hill Country Park','Swadlincote Snowsports Centre','The Big Banana Fun Park','Toboggan Hill Park','Magic Mountain','Woodlands Family Theme Park','Whistler Blackcomb') AND note NOT IN (SELECT name FROM parks);
