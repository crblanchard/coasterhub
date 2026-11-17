-- 181: Family Kingdom Amusement Park (Myrtle Beach), from Carter's RCDB
-- screenshots, 2026-11-17. Safe to run twice.
--   Kiddie Coaster (D.P.V. Wacky Worm, 1994-2024; "Speedy Gonzalez" from 1994
--     to by 2016).
--   Unknown: an RMC Raptor (Stunt Pilot layout) opening 2027, unnamed, so
--     "Unknown" per Carter's rule; shows as Under construction.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Kiddie Coaster','Family Kingdom Amusement Park','Steel','D.P.V. Rides','Wacky Worm',NULL,NULL,NULL,0,NULL,1994,'1994','year','2024','year',1),
 ('Unknown','Family Kingdom Amusement Park','Steel','Rocky Mountain Coasters','RMC Raptor',100.0,50.0,1950.0,3,NULL,2027,'2027','year',NULL,NULL,1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Family Kingdom Amusement Park' AND c.name IN ('Kiddie Coaster','Unknown') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Speedy Gonzalez', 'rcdb', date('now') FROM coasters WHERE park = 'Family Kingdom Amusement Park' AND name = 'Kiddie Coaster';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Family Kingdom Amusement Park' AND c.name = 'Kiddie Coaster' AND g.name = 'Wacky Worms' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
