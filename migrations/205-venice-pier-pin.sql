-- Venice Pier (Los Angeles) was pinned at the town, inland (a park-pins.py
-- estimate). Carter, 2026-11-20: "move venice pier to the center of the
-- venice pier". Wikipedia/Wikidata put the Venice Fishing Pier's landward end
-- at 33.97778, -118.46917; the pier runs about 400 m south-west, so its middle
-- is about 33.9774, -118.4703.
UPDATE parks SET lat = 33.9774, lon = -118.4703 WHERE name = 'Venice Pier';
