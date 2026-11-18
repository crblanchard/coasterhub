-- 184: two things from Carter, 2026-11-18. Safe to run twice.
-- (1) Years on the Walibi Rhône-Alpes former names (183 had them undated):
--     Generator was Boomerang 1988-2013, then EqWalizer 2014-2020; Woodstock
--     Express was Zig Zag 2002 to by 2011, then Scratch to 2015. A dated alias
--     carries the year the name ended ('renamed', added = that year).
UPDATE coaster_aliases SET note='renamed', added=CASE former_name WHEN 'Boomerang' THEN '2013' WHEN 'EqWalizer' THEN '2020' WHEN 'Zig Zag' THEN '2011' WHEN 'Scratch' THEN '2015' END WHERE coaster_id IN (SELECT id FROM coasters WHERE park='Walibi Rhône-Alpes' AND name IN ('Generator','Woodstock Express')) AND former_name IN ('Boomerang','EqWalizer','Zig Zag','Scratch');
-- (2) Midgårdsormen, Djurs Sommerland's Intamin Hot Racer opening 2027:
--     1,978.3 ft, 75.5 ft, 46.6 mph, 3 inversions, 1:47.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + 1, 'Midgårdsormen', 'Djurs Sommerland', 'Steel', 'Intamin', 'Intamin Hot Racer', 75.5, 46.6, 1978.3, 3, 107, 2027, '2027', 'year', NULL, NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name='Midgårdsormen' AND park='Djurs Sommerland');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park='Djurs Sommerland' AND c.name='Midgårdsormen' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind='coaster_added' AND json_extract(a.detail, '$.id') = c.id);
-- (3) Luna Park (Sydney), from Carter's screenshots the same day.
--   Big Dipper (Intamin Hot Racer, 2021-12-26) is the park's second ride of
--     that name, so the 1995 Arrow one (row 2034, at Dreamworld since as Gold
--     Coaster, linked) becomes "Big Dipper (Old)", per Carter's naming rule,
--     with the coaster_renamed row the Worker would write.
--   Boomerang (Gerstlauer shuttle family coaster, 2021-10-23; not a Vekoma
--     Boomerang, so no category). Little Nipper (Preston & Barbieri Mini
--     Coaster, 2021-10-23).
--   Wild Mouse (Girvan Bros wooden wild mouse, 1995, operating; its SBNO
--     spells are not recorded). Its stint at the Royal Agricultural Society
--     Showground (park not in the database) is noted in missing-parks.md.
UPDATE coasters SET name='Big Dipper (Old)' WHERE id=2034 AND name='Big Dipper' AND park='Luna Park (Sydney)';
INSERT INTO activity (at, actor, kind, subject, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Big Dipper (Old)', json_object('id', id, 'from', 'Big Dipper', 'park', 'Luna Park (Sydney)') FROM coasters WHERE id=2034 AND name='Big Dipper (Old)' AND NOT EXISTS (SELECT 1 FROM activity WHERE kind='coaster_renamed' AND subject='Big Dipper (Old)' AND json_extract(detail,'$.park')='Luna Park (Sydney)');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Big Dipper','Luna Park (Sydney)','Steel','Intamin','Intamin Hot Racer',NULL,44.7,NULL,2,NULL,2021,'2021-12-26','day',NULL,NULL,1),
 ('Boomerang','Luna Park (Sydney)','Steel','Gerstlauer','Gerstlauer Shuttle Family',39.4,31.1,593.8,0,NULL,2021,'2021-10-23','day',NULL,NULL,1),
 ('Little Nipper','Luna Park (Sydney)','Steel','Preston & Barbieri','Preston & Barbieri Mini Coaster',NULL,NULL,NULL,0,NULL,2021,'2021-10-23','day',NULL,NULL,1),
 ('Wild Mouse','Luna Park (Sydney)','Wood','Girvan Bros',NULL,NULL,NULL,1312.3,0,61,1995,'1995','year',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park='Luna Park (Sydney)' AND c.name IN ('Big Dipper','Boomerang','Little Nipper','Wild Mouse') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind='coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
