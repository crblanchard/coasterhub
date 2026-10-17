-- 065: Serpent (Niagara Amusement Park & Splash World), from RCDB via Carter's
-- screenshots, 2026-10-17. SDC Galaxi, 45 ft, 1,919 ft, 1:50, opened 27 Aug
-- 2024 (SBNO since Sep 2025 — not recorded, per Carter, so it reads as
-- operating). It is the fourth stop of one travelling Galaxi:
--   Noble Park Funland as Galaxi (1987-88) -> LeSourdsville Lake as Serpent
--   (1989-2002) -> Fun Way Amusement Park as Serpent (2009-19) -> here.
-- Those three parks are not on the site yet and each needs a pin first; when
-- they are added, their rows join this one as one ride, home here.
-- Guarded on name + park, so a second run is a no-op.

INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Serpent', 'Niagara Amusement Park & Splash World', 'Steel', 'SDC', 'SDC Galaxi', 45, NULL, 1919, 0, 110, 1, 2024, '2024-08-27', 'day', NULL, NULL WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Niagara Amusement Park & Splash World') AND NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Serpent' AND park = 'Niagara Amusement Park & Splash World');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Serpent' AND c.park = 'Niagara Amusement Park & Splash World' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Niagara Amusement Park & Splash World');
