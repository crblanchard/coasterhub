-- Carter, 2026-11-26, from the B&M "No model on file" list:
-- 1. Models: Big LEGO Coaster (Legoland Shenzhen) Family Invert; Flight of the
--    Himalayan Eagle (Happy Valley Beijing) Hyper; Lightning (Kuwait
--    Entertainment City) Invert; the Unnamed Surf Coaster (Happy Valley
--    Shanghai) Surf; Dive Coaster (Chimelong Paradise) Dive; The Time Machine
--    (Freestyle Music Park) Sitting. No activity rows (model fills).
UPDATE coasters SET model = CASE name WHEN 'Big LEGO Coaster' THEN 'B&M Family Invert' WHEN 'Flight of the Himalayan Eagle Music Roller Coaster' THEN 'B&M Hyper' WHEN 'Lightning' THEN 'B&M Invert' WHEN 'Unnamed Surf Coaster' THEN 'B&M Surf' WHEN 'Dive Coaster' THEN 'B&M Dive' WHEN 'The Time Machine' THEN 'B&M Sitting' END
WHERE manu = 'Bolliger & Mabillard' AND model IS NULL AND ((name = 'Big LEGO Coaster' AND park = 'Legoland Shenzhen') OR (name = 'Flight of the Himalayan Eagle Music Roller Coaster' AND park = 'Happy Valley (Beijing)') OR (name = 'Lightning' AND park = 'Kuwait Entertainment City') OR (name = 'Unnamed Surf Coaster' AND park = 'Happy Valley (Shanghai)') OR (name = 'Dive Coaster' AND park = 'Chimelong Paradise') OR (name = 'The Time Machine' AND park = 'Freestyle Music Park'));
-- 2. "Remove unknown from hot go park": a B&M "Unknown" (defunct, date
--    unknown) at Hot Go Park - Happy Jungle World. It is Hot Go Dreamworld's
--    B&M wing coaster, a different, unfinished park in Fushun that never
--    opened (Coasterpedia, RCDB via Carter). No rides on it. Its source rows go with it.
DELETE FROM coaster_sources WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Unknown' AND park = 'Hot Go Park - Happy Jungle World');
DELETE FROM open_links WHERE coaster_id IN (SELECT id FROM coasters WHERE name = 'Unknown' AND park = 'Hot Go Park - Happy Jungle World');
DELETE FROM coasters WHERE name = 'Unknown' AND park = 'Hot Go Park - Happy Jungle World' AND id NOT IN (SELECT coaster_id FROM rides);
-- 3. "All manufacturers that are a park please reassign as 'In-House'":
--    Kings Island (Beast; Grizzly at California's Great America, its sister
--    park), Blackpool Pleasure Beach (Wild Mouse; King Solomon's Mines at
--    its Southport sister), Six Flags (Viper), Natural World Amusement Park,
--    and the three already spelled "In-house". Butlin's left for Carter.
UPDATE coasters SET manu = 'In-House' WHERE manu IN ('Kings Island', 'Blackpool Pleasure Beach', 'Six Flags', 'Natural World Amusement Park', 'In-house');
