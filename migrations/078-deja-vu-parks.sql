-- 078: the Deja Vu that became Aftershock was Six Flags Great America's.
--
-- Carter, 2026-10-25, with the RCDB page for Six Flags Over Georgia's Déjà Vu:
-- "Aftershock at silverwood came from six flags great america not six flags
-- over georgia. Please correct and make a new entry for six flags over
-- georgia with the same stats and these opening dates."
--   #1263 Deja Vu, linked to Aftershock (#819) as one ride, sat at Six Flags
--     Over Georgia. Nobody has logged it, so it simply moves to Six Flags
--     Great America and keeps the link. Its dates were Over Georgia's, so
--     they become the years only (2001-2007), not a day that was the other
--     park's; Carter can send Great America's RCDB page for exact ones.
--   A new Deja Vu at Six Flags Over Georgia: Vekoma Giant Inverted
--     Boomerang, same stats (177.2 ft, 61.5 mph, 1,204.1 ft, 3 inv), operated
--     1 Sep 2001 - 2007, not linked to anything.
-- Activity: coaster_edited (park, dates) for #1263, coaster_added for the
-- new row. Guarded on park + name, so a second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 3, json_object('id', id, 'fields', json_array('park', 'opened', 'openedPrec'), 'via', '078') FROM coasters WHERE id = 1263 AND park = 'Six Flags Over Georgia';
UPDATE coasters SET park = 'Six Flags Great America', opened = '2001', openedPrec = 'year', yr = 2001, closed = '2007', closedPrec = 'year' WHERE id = 1263 AND park = 'Six Flags Over Georgia';
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Deja Vu', 'Six Flags Over Georgia', 'Steel', 'Vekoma', 'Vekoma Giant Inverted Boomerang', 177.2, 61.5, 1204.1, 3, NULL, 1, 2001, '2001-09-01', 'day', '2007', 'year' WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Deja Vu' AND park = 'Six Flags Over Georgia');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Deja Vu' AND c.park = 'Six Flags Over Georgia' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id);
