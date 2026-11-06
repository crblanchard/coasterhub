-- 163: two more Boomerang parks from Carter's RCDB screenshots, 2026-11-06,
-- both closed. Boomerangs go into Vekoma Boomerangs.
-- Tivoli Karolinelund (Aalborg, Denmark; closed after 2010; coordinates from
--   Wikipedia): Looping (Pinfari TL59, 1982 to 2010-09-04), Kålormen (Pinfari
--   Big Apple, 1985 to 2010-09-04), Boomerang (1985 to 2010-09-04). Looping,
--   Kålormen and Boomerang all moved on to Family Fun, a park we don't have.
-- Parque de Atracciones de Montjuïc (Barcelona, 1966-1998; no published
--   coordinates, so the pin is an ESTIMATE on the Jardins de Joan Brossa that
--   now cover the site): Boomerang (1990-1998; later Six Flags New Orleans'
--   Zydeco Scream, not here), Ciclón (Robles Bouso, 1973-1998), Loco Ratón
--   (Schiff wild mouse, 1966 to ">= 1977", stored 1977), Mini Montaña Rusa
--   (kiddie, 1966-1998), Montaña Rusa (wood side-friction, 1966-1972), and
--   Vikingo as two rows, (Left) and (Right) (Carter: "two entries because two
--   sides"; Robles Bouso twin shuttle, 1987-1998).
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, v.column4, 0 FROM (VALUES
 ('Tivoli Karolinelund', 57.043392, 9.931639, 'Denmark'),
 ('Parque de Atracciones de Montjuïc', 41.3690, 2.1665, 'Spain')
) v WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Looping','Tivoli Karolinelund','Steel','Pinfari','Pinfari Zyklon',NULL,NULL,NULL,1,125,1982,'1982','year','2010-09-04','day',1),
 ('Kålormen','Tivoli Karolinelund','Steel','Pinfari','Wacky Worm',NULL,NULL,NULL,0,95,1985,'1985','year','2010-09-04','day',1),
 ('Boomerang','Tivoli Karolinelund','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1985,'1985','year','2010-09-04','day',1),
 ('Boomerang','Parque de Atracciones de Montjuïc','Steel','Vekoma','Vekoma Boomerang',116.5,47.0,935.0,3,108,1990,'1990','year','1998-06-01','year',1),
 ('Ciclón','Parque de Atracciones de Montjuïc','Steel','Robles Bouso',NULL,NULL,NULL,NULL,0,NULL,1973,'1973','year','1998-06-01','year',1),
 ('Loco Ratón','Parque de Atracciones de Montjuïc','Steel','B. A. Schiff','Schiff Wild Mouse',NULL,NULL,NULL,0,NULL,1966,'1966','year','1977-06-01','year',1),
 ('Mini Montaña Rusa','Parque de Atracciones de Montjuïc','Steel',NULL,'Kiddie',NULL,NULL,NULL,0,NULL,1966,'1966','year','1998-06-01','year',1),
 ('Montaña Rusa','Parque de Atracciones de Montjuïc','Wood',NULL,NULL,NULL,NULL,NULL,0,NULL,1966,'1966','year','1972-06-01','year',1),
 ('Vikingo (Left)','Parque de Atracciones de Montjuïc','Steel','Robles Bouso',NULL,NULL,NULL,NULL,0,NULL,1987,'1987','year','1998-06-01','year',1),
 ('Vikingo (Right)','Parque de Atracciones de Montjuïc','Steel','Robles Bouso',NULL,NULL,NULL,NULL,0,NULL,1987,'1987','year','1998-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park IN ('Tivoli Karolinelund', 'Parque de Atracciones de Montjuïc') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park IN ('Tivoli Karolinelund', 'Parque de Atracciones de Montjuïc') AND ((c.model = 'Vekoma Boomerang' AND g.name = 'Vekoma Boomerangs') OR (c.model = 'Wacky Worm' AND g.name = 'Wacky Worms')) AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
