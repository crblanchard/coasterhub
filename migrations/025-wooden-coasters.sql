-- 025 — coasters marked Steel that are wood
--
-- /edit's type picker defaults to Steel, so a row whose type nobody set came out
-- Steel (Carter, 2026-09-27: "a bunch are flagged as steel when they should be
-- wood because /edit defaults to that"). Found by reading the live table: rows
-- whose builder or model says wood (GCI, CCI, PTC, Dinn, M&V, "... Wood"), and
-- well-known wooden coasters with no builder on file. Carter approved the
-- confident list; the unsure ones are not here. RMC hybrids stay Steel.
--
-- Matched on name + park, and only while still Steel, so a second run changes
-- nothing and a row someone already fixed is left alone.
UPDATE coasters SET type = 'Wood' WHERE type = 'Steel' AND (name, park) IN (VALUES
  ('Beast', 'Kings Island'),
  ('Cornball Express', 'Indiana Beach'),
  ('Hoosier Hurricane', 'Indiana Beach'),
  ('Lost Coaster of Superstition Mountain', 'Indiana Beach'),
  ('Rampage', 'Alabama Adventure'),
  ('Georgia Cyclone', 'Six Flags Over Georgia'),
  ('Kentucky Rumbler', 'Beech Bend'),
  ('Gwazi (Lion)', 'Busch Gardens Tampa Bay'),
  ('Gwazi (Tiger)', 'Busch Gardens Tampa Bay'),
  ('Ozark Wildcat', 'Celebration City'),
  ('Thunderhead', 'Dollywood'),
  ('White Lightning', 'Fun Spot America - Orlando'),
  ('Wicker Man', 'Alton Towers'),
  ('Wodan Timbur Coaster', 'Europa Park'),
  ('Twister III: Storm Chaser', 'Elitch Gardens'),
  ('Grizzly', 'California''s Great America'),
  ('Hurler', 'Carowinds'),
  ('Boardwalk Bullet', 'Kemah Boardwalk'),
  ('The Racer (Red)', 'Kings Island'),
  ('Great American Scream Machine', 'Six Flags Over Georgia'),
  ('Swamp Fox', 'Family Kingdom Amusement Park'),
  ('Woodstock Express', 'Carowinds'),
  ('Yankee Cannonball', 'Canobie Lake Park'),
  ('Hell Cat', 'Clementon Park'),
  ('Lightning Rod (-2020)', 'Dollywood'),
  ('Mammut', 'Erlebnispark Tripsdrill'),
  ('Wildfire', 'Kolmården'),
  ('Balder', 'Liseberg'),
  ('Shivering Timbers', 'Michigan''s Adventure'),
  ('Wolverine Wildcat', 'Michigan''s Adventure'),
  ('Zach''s Zoomer', 'Michigan''s Adventure'),
  ('Hades', 'Mt. Olympus'),
  ('Silver Comet', 'Niagara Amusement Park & Splash World'),
  ('Tonnerre de Zeus', 'Parc Astérix'),
  ('Big Dipper', 'Pleasure Beach Resort'),
  ('Blue Flyer', 'Pleasure Beach Resort'),
  ('Grand National (Left)', 'Pleasure Beach Resort'),
  ('Wooden Warrior', 'Quassy Amusement Park'),
  ('Avalanche Hellcat', 'Timber Falls Adventure Park'),
  ('Timber', 'Walibi Rhône-Alpes'),
  ('Excalibur', 'Funtown Splashtown U.S.A.'),
  ('Wildcat', 'Frontier City'),
  ('Coaster', 'Playland'),
  ('Dragon Coaster', 'Playland Park'),
  ('Arkansas Twister', 'Magic Springs Theme and Water Park'),
  ('Stampida (Blue)', 'PortAventura Park'),
  ('Sea Dragon', 'Columbus Zoo and Aquarium'),
  ('Twister', 'Gröna Lund')
);
