-- 072: the six riders who were on Lightning Rod (New/I-Box) only move to
-- Lightning Rod (Old/Wood) only, rankings included.
--
-- Carter, 2026-10-22: "Change all six of them so they have old one only
-- please. I think that's true". cmor3, colegarff, maxg, seanpcoakley,
-- unclepat and vacoasterfanatic logged only #611 (now New/I-Box), all
-- undated, so their logs predate the I-Box track. None of them has an
-- Old/Wood row yet, so moving their ride and ranking rows cannot collide.
-- Matched on the users and the two names, so a second run moves nothing.

UPDATE rides SET coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood') WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (New/I-Box)' AND park = 'Dollywood') AND user_slug IN ('cmor3', 'colegarff', 'maxg', 'seanpcoakley', 'unclepat', 'vacoasterfanatic');
UPDATE OR IGNORE rankings SET coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood') WHERE coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (New/I-Box)' AND park = 'Dollywood') AND user_slug IN ('cmor3', 'colegarff', 'maxg', 'seanpcoakley', 'unclepat', 'vacoasterfanatic');
