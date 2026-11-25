-- Three Paramount Parks rides that started as Top Gun (Carter,
-- 2026-11-26): Flight Deck (California's Great America), DareDeviler (Canada's
-- Wonderland, already "Flight Deck" before) and Bat (Kings Island, Top Gun
-- then Flight Deck before it became The Bat and Bat; not the 1981 The Bat).
-- Former names, matched by name + park; a second run adds nothing.
INSERT INTO coaster_aliases (coaster_id, former_name, note, added)
WITH v(name, park, former) AS (VALUES ('Flight Deck', 'California''s Great America', 'Top Gun'),
  ('DareDeviler', 'Canada''s Wonderland', 'Top Gun'), ('Bat', 'Kings Island', 'Top Gun'), ('Bat', 'Kings Island', 'Flight Deck'))
SELECT c.id, v.former, 'rcdb', date('now')
FROM v JOIN coasters c ON c.name = v.name AND c.park = v.park
WHERE NOT EXISTS (SELECT 1 FROM coaster_aliases a WHERE a.coaster_id = c.id AND a.former_name = v.former);
