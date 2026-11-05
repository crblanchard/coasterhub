-- 151: Parc Spirou Provence (Monteux, France), every coaster, from Carter's
-- RCDB screenshots, 2026-11-05. Coordinates looked up (Provence Guide /
-- OOPARC, which agree): 44.0206, 4.9703.
--   Nid des Marsupilamis (RES Roller Ball M, 93.5 ft, 2019-04-17) — a fourth
--     Roller Ball, into RES Roller Balls (Carter: "there's two more roller balls
--     here's one"). En avant Seccotine (Zierer Force Zero, kiddie, 2018-06-16),
--     Kyûbi Unchained (Zamperla Family Thrill Launch 670m, 103.3 ft, 46.6 mph,
--     2,198.2 ft, 2026-04-04), Spirou Racing (Zierer ESC 535, 2018-06-16), Wanted
--     Dalton (Zierer Force Two, 2018-06-16; "Wanted by Lucky Luke" in 2018).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Parc Spirou Provence', 44.0206, 4.9703, 'France', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Parc Spirou Provence');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Nid des Marsupilamis','Parc Spirou Provence','Steel','RES Rides','RES Roller Ball',93.5,NULL,NULL,0,NULL,2019,'2019-04-17','day',NULL,NULL,1),
 ('En avant Seccotine','Parc Spirou Provence','Steel','Zierer','Zierer Force',NULL,NULL,NULL,0,NULL,2018,'2018-06-16','day',NULL,NULL,1),
 ('Kyûbi Unchained','Parc Spirou Provence','Steel','Zamperla','Zamperla Family Thrill',103.3,46.6,2198.2,0,NULL,2026,'2026-04-04','day',NULL,NULL,1),
 ('Spirou Racing','Parc Spirou Provence','Steel','Zierer','Zierer Force',NULL,NULL,NULL,0,NULL,2018,'2018-06-16','day',NULL,NULL,1),
 ('Wanted Dalton','Parc Spirou Provence','Steel','Zierer','Zierer Force',NULL,NULL,NULL,0,NULL,2018,'2018-06-16','day',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Parc Spirou Provence' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Wanted by Lucky Luke', 'rcdb', date('now') FROM coasters WHERE park = 'Parc Spirou Provence' AND name = 'Wanted Dalton';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Parc Spirou Provence' AND c.name = 'Nid des Marsupilamis' AND g.name = 'RES Roller Balls' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
