-- Playland Fresno's Roller Coaster closed in 2002; its opening date is not
-- known (Carter, 2026-11-20: "closed in 2002 no set opening date"). The
-- source had put 2002 as the OPENING year, which showed it as running.
-- Entered by hand, so 'manual'.
UPDATE coasters SET yr = NULL, opened = NULL, openedPrec = NULL, closed = '2002', closedPrec = 'year' WHERE name = 'Roller Coaster' AND park = 'Playland Fresno';
DELETE FROM coaster_sources WHERE field = 'opened' AND coaster_id = (SELECT id FROM coasters WHERE name = 'Roller Coaster' AND park = 'Playland Fresno');
INSERT OR REPLACE INTO coaster_sources (coaster_id, field, source, ref) SELECT id, 'closed', 'manual', NULL FROM coasters WHERE name = 'Roller Coaster' AND park = 'Playland Fresno';
