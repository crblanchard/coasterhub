-- 062: six removed Kentucky Kingdom coasters, from RCDB via Carter's
-- screenshots, 2026-10-17.
--   Vampire (1990-1999): Vekoma Boomerang, 116.5 ft, 47 mph, 935 ft, 3 inv,
--     1:48. RCDB: Star Lake Amusement Park -> Kentucky Kingdom -> Six Flags New
--     England as Flashback (#454, opened 2000), so it is linked to Flashback,
--     home Flashback, and goes in Vekoma Boomerangs. Star Lake is not on the
--     site. (Great Escape also has a Flashback, #445: a different Boomerang.)
--   Twisted Twins (1998-2007): CCI dual-track wood, tracks Stella and Lola,
--     each 80 ft, 55 mph, 3,000 ft, 2:12. Two credits, one per track, named
--     the way the site names racing pairs (Gemini (Blue)/(Red), Lightning
--     Racer (Thunder)/(Lightning)) — Carter: "as two separate credits like we
--     normally do". First called Twisted Sisters (1998-2001): an alias each.
--   Starchaser (1987-1995): Schwarzkopf Jet Star, 44.3 ft, 31.1 mph,
--     1,765.1 ft. RCDB lists Beech Bend and Noble Park Funland before it and
--     Darien Lake / Great Escape (Nightmare) after; none of the later ones is
--     on the site, and the site's Beech Bend Jet Star (#1312, 1972-84) is
--     already linked to Tig'rr at Indiana Beach (opened 1984), which this
--     page contradicts — left alone, unlinked, until RCDB settles which
--     Beech Bend Jet Star went where.
--   Road Runner Express (May 2000-2009): Maurer Wild Mouse, 49.3 ft, 28 mph,
--     1,213.9 ft, 1:32. Relocated to Six Flags New England as Gotham City
--     Gauntlet (#451, opened 2011): linked, home Gotham City Gauntlet.
--   Greezed Lightnin' (25 Apr 2003 - 31 Oct 2009): Schwarzkopf Shuttle Loop,
--     137.8 ft, 57 mph, 863 ft, 1 inv, 0:38. Earlier Tidal Wave (Six Flags
--     Great America) and Viper (Six Flags Over Georgia) are not on the site.
-- All guarded on name + park, so a second run is a no-op.

INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Vampire', 'Kentucky Kingdom', 'Steel', 'Vekoma', 'Vekoma Boomerang', 116.5, 47, 935, 3, 108, 1, 1990, '1990', 'year', '1999', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Vampire' AND park = 'Kentucky Kingdom');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Twisted Twins (Stella)', 'Kentucky Kingdom', 'Wood', 'Custom Coasters International', 'CCI Wood', 80, 55, 3000, 0, 132, 1, 1998, '1998-06-20', 'day', '2007', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Twisted Twins (Stella)' AND park = 'Kentucky Kingdom');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Twisted Twins (Lola)', 'Kentucky Kingdom', 'Wood', 'Custom Coasters International', 'CCI Wood', 80, 55, 3000, 0, 132, 1, 1998, '1998-06-20', 'day', '2007', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Twisted Twins (Lola)' AND park = 'Kentucky Kingdom');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Starchaser', 'Kentucky Kingdom', 'Steel', 'Schwarzkopf', 'Schwarzkopf Jet Star', 44.3, 31.1, 1765.1, 0, NULL, 1, 1987, '1987', 'year', '1995', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Starchaser' AND park = 'Kentucky Kingdom');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Road Runner Express', 'Kentucky Kingdom', 'Steel', 'Maurer Rides', 'Maurer Wild Mouse', 49.3, 28, 1213.9, 0, 92, 1, 2000, '2000-05', 'month', '2009', 'year' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Road Runner Express' AND park = 'Kentucky Kingdom');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Greezed Lightnin''', 'Kentucky Kingdom', 'Steel', 'Schwarzkopf', 'Schwarzkopf Shuttle Loop', 137.8, 57, 863, 1, 38, 1, 2003, '2003-04-25', 'day', '2009-10-31', 'day' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Kentucky Kingdom') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Greezed Lightnin''' AND park = 'Kentucky Kingdom');
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Twisted Sisters (Stella)', 'rcdb', date('now') FROM coasters WHERE name = 'Twisted Twins (Stella)' AND park = 'Kentucky Kingdom';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Twisted Sisters (Lola)', 'rcdb', date('now') FROM coasters WHERE name = 'Twisted Twins (Lola)' AND park = 'Kentucky Kingdom';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.name = 'Vampire' AND c.park = 'Kentucky Kingdom' AND g.name = 'Vekoma Boomerangs';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, h.id FROM coasters h, coasters x WHERE h.id = 454 AND h.name = 'Flashback' AND h.park = 'Six Flags New England' AND ((x.name = 'Vampire' AND x.park = 'Kentucky Kingdom') OR x.id = h.id);
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT x.id, h.id FROM coasters h, coasters x WHERE h.id = 451 AND h.name = 'Gotham City Gauntlet: Escape from Arkham Asylum' AND h.park = 'Six Flags New England' AND ((x.name = 'Road Runner Express' AND x.park = 'Kentucky Kingdom') OR x.id = h.id);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Kentucky Kingdom' AND c.name IN ('Vampire', 'Twisted Twins (Stella)', 'Twisted Twins (Lola)', 'Starchaser', 'Road Runner Express', 'Greezed Lightnin''') AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Kentucky Kingdom');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'clone_set', g.name, (SELECT COUNT(*) FROM clone_members m WHERE m.group_id = g.id), json_object('made', 0, 'via', '062') FROM clone_groups g WHERE g.name = 'Vekoma Boomerangs' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'clone_set' AND a.subject = g.name AND a.detail LIKE '%"via":"062"%');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '062') FROM coasters h WHERE h.id = 454 AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) = 2 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id AND a.detail LIKE '%"via":"062"%');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '062') FROM coasters h WHERE h.id = 451 AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) = 2 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id AND a.detail LIKE '%"via":"062"%');
