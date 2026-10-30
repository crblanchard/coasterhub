-- 086: Four parks with no region, which /log groups under "No location yet"
-- (Carter, 2026-10-30: "four coasters still have 'no location yet' as a
-- location - please review"). Six coasters between them.
--
--   Holleshof             a farm park at Schlecker Deich 2, Wachtendonk, North
--                         Rhine-Westphalia (RCDB 15386). Its pin was already
--                         right; only the region was missing. -> Germany
--   S.J. Entertainment    a South Jersey carnival; its pin (39.94, -75.13) is
--                         Camden County. Crazy Mouse, Keltan 2019. -> New Jersey, US
--   Fun Time Shows        a travelling carnival based in southeast Missouri,
--                         third generation, touring the Midwest. Max's Crazy
--                         Cobra, Wacky Worm, Orient Express. -> Missouri, US
--   Vancraeyenest Family  French travelling showmen; King (Soquet, 1995) plays
--                         the Foire du Trône in Paris each spring. -> France
--
-- Travelling shows get a home region and no pin, the way Butler Amusements,
-- Ray Cammack Shows and Todd Armstrong Shows already are. Matched by name; a
-- second run changes nothing.
UPDATE parks SET region = 'Germany' WHERE name = 'Holleshof' AND (region IS NULL OR region = '');
UPDATE parks SET region = 'New Jersey, US' WHERE name = 'S.J. Entertainment' AND (region IS NULL OR region = '');
UPDATE parks SET region = 'Missouri, US' WHERE name = 'Fun Time Shows' AND (region IS NULL OR region = '');
UPDATE parks SET region = 'France' WHERE name = 'Vancraeyenest Family' AND (region IS NULL OR region = '');
