-- 143: real coordinates for 16 parks that were on estimated pins, looked up on
-- 2026-11-05 at Carter's go-ahead ("can you look them up yourself") from the
-- parks' Wikipedia infoboxes and USGS place records, via web search:
--   Everland: Wikipedia
--   Lotte World Adventure: Seoul Guide GPS
--   Gyeongju World: Wikipedia
--   Sesame Place (PA): Wikipedia
--   Sesame Place (CA): Wikipedia
--   Wonderland Amusement Park: Wikipedia
--   Castles N' Coasters: Wikipedia
--   Jenkinson's Boardwalk: Wikipedia (the boardwalk)
--   Jolly Roger Amusement Park: USGS GNIS / TopoZone
--   Adventure Park USA: Wikipedia
--   Universal Studios Singapore: Wikipedia / Sygic
--   Universal Studios Beijing: Wikipedia
--   Dreamworld: Wikipedia
--   Luna Park (Sydney): Wikipedia
--   Gumbuya World: Wikipedia
--   Warner Bros. Movie World: Wikipedia
-- Still estimated (no published coordinates found): Keansburg Amusement Park,
-- Old Town. Park coordinate edits write no activity row. Safe to run twice.
UPDATE parks SET
  lat = CASE name
    WHEN 'Everland' THEN 37.29389
    WHEN 'Lotte World Adventure' THEN 37.511566
    WHEN 'Gyeongju World' THEN 35.837
    WHEN 'Sesame Place (PA)' THEN 40.1858
    WHEN 'Sesame Place (CA)' THEN 32.5884
    WHEN 'Wonderland Amusement Park' THEN 35.240752
    WHEN 'Castles N'' Coasters' THEN 33.5723
    WHEN 'Jenkinson''s Boardwalk' THEN 40.0937
    WHEN 'Jolly Roger Amusement Park' THEN 38.3592808
    WHEN 'Adventure Park USA' THEN 39.379388
    WHEN 'Universal Studios Singapore' THEN 1.2542
    WHEN 'Universal Studios Beijing' THEN 39.8563
    WHEN 'Dreamworld' THEN -27.864
    WHEN 'Luna Park (Sydney)' THEN -33.8476
    WHEN 'Gumbuya World' THEN -38.069185
    WHEN 'Warner Bros. Movie World' THEN -27.9075 END,
  lon = CASE name
    WHEN 'Everland' THEN 127.20278
    WHEN 'Lotte World Adventure' THEN 127.098311
    WHEN 'Gyeongju World' THEN 129.282
    WHEN 'Sesame Place (PA)' THEN -74.872
    WHEN 'Sesame Place (CA)' THEN -117.0101
    WHEN 'Wonderland Amusement Park' THEN -101.83209
    WHEN 'Castles N'' Coasters' THEN -112.1188
    WHEN 'Jenkinson''s Boardwalk' THEN -74.0366
    WHEN 'Jolly Roger Amusement Park' THEN -75.0768496
    WHEN 'Adventure Park USA' THEN -77.278179
    WHEN 'Universal Studios Singapore' THEN 103.8227
    WHEN 'Universal Studios Beijing' THEN 116.6789
    WHEN 'Dreamworld' THEN 153.3158
    WHEN 'Luna Park (Sydney)' THEN 151.21
    WHEN 'Gumbuya World' THEN 145.658643
    WHEN 'Warner Bros. Movie World' THEN 153.3125 END
WHERE name IN ('Everland','Lotte World Adventure','Gyeongju World','Sesame Place (PA)','Sesame Place (CA)','Wonderland Amusement Park','Castles N'' Coasters','Jenkinson''s Boardwalk','Jolly Roger Amusement Park','Adventure Park USA','Universal Studios Singapore','Universal Studios Beijing','Dreamworld','Luna Park (Sydney)','Gumbuya World','Warner Bros. Movie World');
-- Then Carter sent the last two himself, same day:
UPDATE parks SET lat = CASE name WHEN 'Keansburg Amusement Park' THEN 40.455348 ELSE 28.332413 END, lon = CASE name WHEN 'Keansburg Amusement Park' THEN -74.134676 ELSE -81.515875 END WHERE name IN ('Keansburg Amusement Park', 'Old Town');
