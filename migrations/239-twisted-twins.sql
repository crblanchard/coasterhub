-- Twisted Twins at Kentucky Kingdom (Carter, 2026-11-25: "were twisted twins
-- in any of the databases ... they were called stella and lola I think the two
-- sides"). From German Wikipedia's infobox (open_raw dewiki 'Twisted Twins'):
-- CCI duelling wooden coaster, opened 20 June 1998, closed 2007, 24 m
-- (79 ft), 89 km/h (55 mph), 914 m (2,999 ft) per track, 2:12. The sides are
-- Stella and Lola (the station sign on Commons: "pink 'Lola' and green
-- 'Stella' arrows"), so two rows per the duelling rule. Model CCI Wood, the
-- string the other CCI woodies use.
-- Its structure was rebuilt by RMC into Storm Chaser (2016), now Wind Chaser:
-- a new ride, not a relocation, so no same_ride link.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Twisted Twins (Stella)','Kentucky Kingdom','Wood','Custom Coasters International','CCI Wood',79.0,55.0,2999.0,0,132,1998,'1998-06-20','day','2007','year',1),
 ('Twisted Twins (Lola)','Kentucky Kingdom','Wood','Custom Coasters International','CCI Wood',79.0,55.0,2999.0,0,132,1998,'1998-06-20','day','2007','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Kentucky Kingdom' AND c.name IN ('Twisted Twins (Stella)', 'Twisted Twins (Lola)') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT c.id, 'dewiki', 'Twisted Twins', 'approved', '2026-11-25' FROM coasters c WHERE c.park = 'Kentucky Kingdom' AND c.name IN ('Twisted Twins (Stella)', 'Twisted Twins (Lola)');
