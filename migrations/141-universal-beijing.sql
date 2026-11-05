-- 141: Universal Studios Beijing (Tongzhou), from Carter's RCDB screenshots,
-- 2026-11-05. English names only (Carter: "dont need chinese names"). Pin is an
-- ESTIMATE (missing-parks.md). All opened 2021-09-20 except Jurassic Flyers
-- (2021-09-30).
--   Decepticoaster (B&M sitting coaster, tire-propelled launch, 121.7 ft,
--   63.8 mph, 4,150.3 ft, 7 inversions, 2:35); Flight of the Hippogriff (MACK
--   Youngstar, 40 ft, 1,017.1 ft); Jurassic Flyers (MACK inverted powered,
--   50.5 ft, 1,958.7 ft); Loop-Dee-Doop-Dee (Jinma family coaster KSC-18A,
--   indoor, 31.2 ft, 761.2 ft). Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Universal Studios Beijing', 39.8560, 116.6780, 'China', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Universal Studios Beijing');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Decepticoaster','Universal Studios Beijing','Steel','Bolliger & Mabillard','B&M Sitting',121.7,63.8,4150.3,7,155,2021,'2021-09-20','day',NULL,NULL,1),
 ('Flight of the Hippogriff','Universal Studios Beijing','Steel','MACK Rides','MACK Youngstar',40.0,29.1,1017.1,0,NULL,2021,'2021-09-20','day',NULL,NULL,1),
 ('Jurassic Flyers','Universal Studios Beijing','Steel','MACK Rides','MACK Inverted Powered Coaster',50.5,19.0,1958.7,0,NULL,2021,'2021-09-30','day',NULL,NULL,1),
 ('Loop-Dee-Doop-Dee','Universal Studios Beijing','Steel','Jinma Rides','Jinma Family Coaster',31.2,21.1,761.2,0,NULL,2021,'2021-09-20','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Universal Studios Beijing' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
