-- 164: Playcenter São Paulo (1973-2012), from Carter's RCDB screenshots,
-- 2026-11-06. No published coordinates found, so the pin is an ESTIMATE on the
-- park's old site by the Marginal Tietê (missing-parks.md). All removed:
--   Alpen Blitz (Schwarzkopf Alpen Blitz II, powered, 10/1989-1996).
--   Boomerang (1997 to 2012-04-01; later Parque Diversiones' Búmeran, not here),
--     into Vekoma Boomerangs.
--   Colossus (Schwarzkopf Double Looping, "<= 1981" stored 1981, to 1986; was
--     "Looping Star"; later Dorney Park's Laser and Wiener Prater's
--     Teststrecke, rows we don't have).
--   Dragon (Zamperla single helix, 2003 to 7/2009; also HotZone and Playland
--     Osasco, not here). Happy Mountain (Três Eixos, 2005 to 5/2011).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Playcenter São Paulo', -23.5196, -46.6672, 'Brazil', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Playcenter São Paulo');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Alpen Blitz','Playcenter São Paulo','Steel','Schwarzkopf','Schwarzkopf Alpen Blitz',NULL,NULL,NULL,0,NULL,1989,'1989-10','month','1996-06-01','year',1),
 ('Boomerang','Playcenter São Paulo','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1997,'1997','year','2012-04-01','day',1),
 ('Colossus','Playcenter São Paulo','Steel','Schwarzkopf','Schwarzkopf Looper',93.0,52.0,2200.0,2,120,1981,'1981','year','1986-06-01','year',1),
 ('Dragon','Playcenter São Paulo','Steel','Zamperla','Zamperla Powered',NULL,NULL,NULL,0,NULL,2003,'2003','year','2009-07-01','month',1),
 ('Happy Mountain','Playcenter São Paulo','Steel','Três Eixos',NULL,NULL,NULL,NULL,0,NULL,2005,'2005','year','2011-05-01','month',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Playcenter São Paulo' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Looping Star', 'rcdb', date('now') FROM coasters WHERE park = 'Playcenter São Paulo' AND name = 'Colossus';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Playcenter São Paulo' AND c.name = 'Boomerang' AND g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
