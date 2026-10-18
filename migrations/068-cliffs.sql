-- 068: Cliff's Amusement Park (Albuquerque, NM), from RCDB via Carter's
-- screenshots and pin, 2026-10-18.
--   Mad Mouse (1964-81): Allan Herschell Wild Mouse, no stats on RCDB. It went
--     on to Magic Mesa Fun Park, which is not on the site.
--   Galaxi (since 1977): SDC Galaxi, no stats on RCDB.
--   New Mexico Rattler (since 28 Sep 2002): CCI wood (hybrid), 80 ft,
--     47 mph, 2,750 ft, 1:15.
-- None of the three models has a category on the site (Galaxi, Jet Star and
-- Herschell Wild Mouse have none yet), so no clone_members rows.
-- Guarded on name + park, so a second run is a no-op.

INSERT INTO parks (name, lat, lon, region) SELECT 'Cliff''s Amusement Park', 35.14354605302944, -106.58905638970585, 'New Mexico, US' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Cliff''s Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Mad Mouse', 'Cliff''s Amusement Park', 'Steel', 'Allan Herschell', 'Allan Herschell Wild Mouse', NULL, NULL, NULL, 0, NULL, 1, 1964, '1964', 'year', '1981', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Cliff''s Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Mad Mouse' AND park = 'Cliff''s Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Galaxi', 'Cliff''s Amusement Park', 'Steel', 'SDC', 'SDC Galaxi', NULL, NULL, NULL, 0, NULL, 1, 1977, '1977', 'year', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Cliff''s Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Galaxi' AND park = 'Cliff''s Amusement Park');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'New Mexico Rattler', 'Cliff''s Amusement Park', 'Wood', 'Custom Coasters International', 'CCI Wood', 80, 47, 2750, 0, 75, 1, 2002, '2002-09-28', 'day', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Cliff''s Amusement Park') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'New Mexico Rattler' AND park = 'Cliff''s Amusement Park');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Cliff''s Amusement Park' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = c.park);
