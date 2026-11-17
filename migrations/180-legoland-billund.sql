-- 180: Legoland Billund, from Carter's RCDB screenshots, 2026-11-17.
-- The four rows already in had no stats; filled (no activity rows, per
-- Carter 2026-11-05). New: Minifigure Speedway, a dueling Zierer Force with
-- two named sides (Banana Juice / Popcorn, two rows, 2026-03-28), and Timber
-- Ride (Zierer Tivoli small, 1978 to 2013-08-19). Polar X-plorer is a custom
-- Zierer ESC: no model string fits, so NULL. Safe to run twice.
UPDATE coasters SET type='Steel', manu='MACK Rides', model='MACK Powered Coaster', inv=0, yr=1997, opened='1997', openedPrec='year' WHERE name='Dragen' AND park='Legoland Billund';
UPDATE coasters SET type='Steel', manu='Zierer', model='Zierer Force', h=36.1, s=28.6, l=921.9, inv=0, yr=2018, opened='2018-03-24', openedPrec='day' WHERE name='Flying Eagle' AND park='Legoland Billund';
UPDATE coasters SET type='Steel', manu='Zierer', h=62.3, s=40.4, l=1633.8, inv=0, yr=2012, opened='2012-04-29', openedPrec='day' WHERE name='Polar X-plorer' AND park='Legoland Billund';
UPDATE coasters SET type='Steel', manu='MACK Rides', model='MACK Wild Mouse', h=51.8, s=35.0, l=1312.3, inv=0, yr=2002, opened='2002-03-23', openedPrec='day' WHERE name='X-treme Racers' AND park='Legoland Billund';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Minifigure Speedway (Banana Juice)','Legoland Billund','Steel','Zierer','Zierer Force',NULL,34.8,NULL,0,NULL,2026,'2026-03-28','day',NULL,NULL,1),
 ('Minifigure Speedway (Popcorn)','Legoland Billund','Steel','Zierer','Zierer Force',NULL,34.8,NULL,0,NULL,2026,'2026-03-28','day',NULL,NULL,1),
 ('Timber Ride','Legoland Billund','Steel','Zierer','Zierer Tivoli',10.8,16.2,197.5,0,NULL,1978,'1978','year','2013-08-19','day',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Legoland Billund' AND c.name IN ('Minifigure Speedway (Banana Juice)','Minifigure Speedway (Popcorn)','Timber Ride') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Legoland Billund' AND c.name = 'Timber Ride' AND g.name = 'Zierer Tivolis' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
