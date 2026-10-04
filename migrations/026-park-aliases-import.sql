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
-- One INSERT per name: D1 refused the first version, a single SELECT of twenty
-- UNION ALLs ("too many terms in compound SELECT").
--
-- Check after:
--   SELECT * FROM park_aliases ORDER BY park;
INSERT INTO park_aliases (park, former_name) SELECT 'Pleasure Beach Resort', 'Blackpool Pleasure Beach' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Pleasure Beach Resort') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Pleasure Beach Resort' AND former_name = 'Blackpool Pleasure Beach');
INSERT INTO park_aliases (park, former_name) SELECT 'Busch Gardens Tampa Bay', 'Busch Gardens Tampa' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Busch Gardens Tampa Bay') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Busch Gardens Tampa Bay' AND former_name = 'Busch Gardens Tampa');
INSERT INTO park_aliases (park, former_name) SELECT 'PortAventura Park', 'PortAventura' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'PortAventura Park') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'PortAventura Park' AND former_name = 'PortAventura');
INSERT INTO park_aliases (park, former_name) SELECT 'Heide Park Resort', 'Heide Park' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Heide Park Resort') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Heide Park Resort' AND former_name = 'Heide Park');
INSERT INTO park_aliases (park, former_name) SELECT 'Plopsaland Belgium', 'Plopsaland De Panne' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Plopsaland Belgium') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Plopsaland Belgium' AND former_name = 'Plopsaland De Panne');
INSERT INTO park_aliases (park, former_name) SELECT 'Erlebnispark Tripsdrill', 'Tripsdrill' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Erlebnispark Tripsdrill') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Erlebnispark Tripsdrill' AND former_name = 'Tripsdrill');
INSERT INTO park_aliases (park, former_name) SELECT 'Chessington World of Adventures', 'Chessington' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Chessington World of Adventures') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Chessington World of Adventures' AND former_name = 'Chessington');
INSERT INTO park_aliases (park, former_name) SELECT 'Chessington World of Adventures', 'Chessington WOA' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Chessington World of Adventures') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Chessington World of Adventures' AND former_name = 'Chessington WOA');
INSERT INTO park_aliases (park, former_name) SELECT 'Fun Spot America - Kissimmee', 'Fun Spot Kissimmee' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fun Spot America - Kissimmee') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Fun Spot America - Kissimmee' AND former_name = 'Fun Spot Kissimmee');
INSERT INTO park_aliases (park, former_name) SELECT 'Fun Spot America - Orlando', 'Fun Spot Orlando' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fun Spot America - Orlando') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Fun Spot America - Orlando' AND former_name = 'Fun Spot Orlando');
INSERT INTO park_aliases (park, former_name) SELECT 'Fun Spot America - Atlanta', 'Fun Spot Atlanta' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fun Spot America - Atlanta') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Fun Spot America - Atlanta' AND former_name = 'Fun Spot Atlanta');
INSERT INTO park_aliases (park, former_name) SELECT 'Plopsaland Deutschland', 'Holiday Park' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Plopsaland Deutschland') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Plopsaland Deutschland' AND former_name = 'Holiday Park');
INSERT INTO park_aliases (park, former_name) SELECT 'Disneyland Park (Paris)', 'Disneyland Paris' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Disneyland Park (Paris)') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Disneyland Park (Paris)' AND former_name = 'Disneyland Paris');
INSERT INTO park_aliases (park, former_name) SELECT 'Islands of Adventure', 'Universal Islands of Adventure' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Islands of Adventure') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Islands of Adventure' AND former_name = 'Universal Islands of Adventure');
INSERT INTO park_aliases (park, former_name) SELECT 'Universal Studios Florida', 'Universal Studios Orlando' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Universal Studios Florida') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Universal Studios Florida' AND former_name = 'Universal Studios Orlando');
INSERT INTO park_aliases (park, former_name) SELECT 'Ferrari Land', 'PortAventura - Ferrari Land' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Ferrari Land') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Ferrari Land' AND former_name = 'PortAventura - Ferrari Land');
INSERT INTO park_aliases (park, former_name) SELECT 'Parque de Atracciones Monte Igueldo', 'Monte Igueldo' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de Atracciones Monte Igueldo') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Parque de Atracciones Monte Igueldo' AND former_name = 'Monte Igueldo');
INSERT INTO park_aliases (park, former_name) SELECT 'Goats on the Roof of the Smokies', 'Goats On The Roof' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Goats on the Roof of the Smokies') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Goats on the Roof of the Smokies' AND former_name = 'Goats On The Roof');
INSERT INTO park_aliases (park, former_name) SELECT 'Nickelodeon Universe', 'Nickelodeon Universe (MN)' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Nickelodeon Universe') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Nickelodeon Universe' AND former_name = 'Nickelodeon Universe (MN)');
INSERT INTO park_aliases (park, former_name) SELECT 'Nickelodeon Universe Theme Park', 'Nickelodeon Universe (NJ)' WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Nickelodeon Universe Theme Park') AND NOT EXISTS (SELECT 1 FROM park_aliases WHERE park = 'Nickelodeon Universe Theme Park' AND former_name = 'Nickelodeon Universe (NJ)');
