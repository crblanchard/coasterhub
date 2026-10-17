-- 054: Vortex (Kings Island) closed 27 October 2019.
--
-- Carter, 2026-10-17: "vortex closed 10/27/2019". The row had no closing date,
-- so the site showed it as operating. The activity row is the Worker's
-- coaster_edited shape, written first so its guard (still open) can see the
-- row it is about; both statements are no-ops on a second run.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', c.name, 2, json_object('id', c.id, 'fields', json_array('closed', 'closedPrec'), 'via', '054')
  FROM coasters c WHERE c.name = 'Vortex' AND c.park = 'Kings Island' AND c.closed IS NULL;
UPDATE coasters SET closed = '2019-10-27', closedPrec = 'day' WHERE name = 'Vortex' AND park = 'Kings Island' AND closed IS NULL;
