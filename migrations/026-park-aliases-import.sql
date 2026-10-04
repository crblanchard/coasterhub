-- 026: the names riders' spreadsheets call parks by, recorded as other names
-- for the parks we already have (2026-10-04).
--
-- Found reading a friend's ranking sheet ("Nerd Sheet v2", 886 rows, mostly
-- UK and Europe) against the database: about 117 rows named a park we have
-- under a different name — "Busch Gardens Tampa" for Busch Gardens Tampa Bay,
-- "Holiday Park" for what is Plopsaland Deutschland now. /import matches parks
-- exactly or by a recorded former name (park_aliases) and never fuzzily (see
-- findPark in import.html: "Disneyland" is not "Disneyland Park (Paris)"), so
-- the fix is the alias, which helps every import and every old link after it.
--
-- Each pair was checked: the sheet's coasters at that name are the coasters we
-- have at the target park (e.g. 9 of 9 for Busch Gardens Tampa, 11 of 15 for
-- Blackpool Pleasure Beach). Typos and one-off nicknames are left out.
--
-- Safe to run twice: a row goes in only when the target park exists and the
-- pair is not already there. The park_aliases UNIQUE(park, former_name) is the
-- backstop. Raw SQL skips the Worker, so run Actions -> "Sync static JSON from
-- D1" afterwards (the aliases ride along with /api/coasters, not a static file,
-- so the live site picks them up at once either way).
--
-- Check after:
--   SELECT * FROM park_aliases ORDER BY park;
INSERT INTO park_aliases (park, former_name)
SELECT v.park, v.former FROM (
  SELECT 'Pleasure Beach Resort' AS park, 'Blackpool Pleasure Beach' AS former
  UNION ALL SELECT 'Busch Gardens Tampa Bay', 'Busch Gardens Tampa'
  UNION ALL SELECT 'PortAventura Park', 'PortAventura'
  UNION ALL SELECT 'Heide Park Resort', 'Heide Park'
  UNION ALL SELECT 'Plopsaland Belgium', 'Plopsaland De Panne'
  UNION ALL SELECT 'Erlebnispark Tripsdrill', 'Tripsdrill'
  UNION ALL SELECT 'Chessington World of Adventures', 'Chessington'
  UNION ALL SELECT 'Chessington World of Adventures', 'Chessington WOA'
  UNION ALL SELECT 'Fun Spot America - Kissimmee', 'Fun Spot Kissimmee'
  UNION ALL SELECT 'Fun Spot America - Orlando', 'Fun Spot Orlando'
  UNION ALL SELECT 'Fun Spot America - Atlanta', 'Fun Spot Atlanta'
  UNION ALL SELECT 'Plopsaland Deutschland', 'Holiday Park'
  UNION ALL SELECT 'Disneyland Park (Paris)', 'Disneyland Paris'
  UNION ALL SELECT 'Islands of Adventure', 'Universal Islands of Adventure'
  UNION ALL SELECT 'Universal Studios Florida', 'Universal Studios Orlando'
  UNION ALL SELECT 'Ferrari Land', 'PortAventura - Ferrari Land'
  UNION ALL SELECT 'Parque de Atracciones Monte Igueldo', 'Monte Igueldo'
  UNION ALL SELECT 'Goats on the Roof of the Smokies', 'Goats On The Roof'
  UNION ALL SELECT 'Nickelodeon Universe', 'Nickelodeon Universe (MN)'
  UNION ALL SELECT 'Nickelodeon Universe Theme Park', 'Nickelodeon Universe (NJ)'
) AS v
WHERE EXISTS (SELECT 1 FROM parks p WHERE p.name = v.park)
  AND NOT EXISTS (SELECT 1 FROM park_aliases a WHERE a.park = v.park AND a.former_name = v.former);
