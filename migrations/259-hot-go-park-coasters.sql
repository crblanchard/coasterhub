-- The rest of Hot Go Park - Happy Jungle World (Fushun), from Carter's RCDB
-- screenshot, 2026-11-26 ("rest of hotgo park yes just do your best"): every
-- coaster opened in 2014. Jungle Walk (suspended family) and Light-Speed
-- Coaster (inverted) run; Forest Slide and Mine Train stand idle, so closed
-- with the date unknown (no SBNO on the site). No source names a maker for
-- any of the four: a 2013 forum post expected Vekoma (a suspended family
-- coaster and a mine train), never confirmed, so maker and model stay NULL.
-- Time Travel was already in. Idempotent; matched by name + park.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Jungle Walk','Hot Go Park - Happy Jungle World','Steel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2014,'2014','year',NULL,NULL,1),
 ('Light-Speed Coaster','Hot Go Park - Happy Jungle World','Steel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2014,'2014','year',NULL,NULL,1),
 ('Forest Slide','Hot Go Park - Happy Jungle World','Steel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2014,'2014','year','?','unknown',1),
 ('Mine Train','Hot Go Park - Happy Jungle World','Steel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,2014,'2014','year','?','unknown',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Hot Go Park - Happy Jungle World' AND c.name IN ('Jungle Walk','Light-Speed Coaster','Forest Slide','Mine Train') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
