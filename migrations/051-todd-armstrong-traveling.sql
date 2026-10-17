-- 051: Todd Armstrong Shows is a traveling show, so it has no pin.
--
-- Carter, 2026-10-17: "remove location from todd armstrong shows it's
-- travling". It had a point in Las Vegas; with no coordinates it drops off the
-- map and reads "Traveling show" on its page and on /parks (CoasterHub.traveling
-- is just "no coordinates"). Its region, Nevada, US, stays, like every other
-- traveling show's country. A second run changes nothing.

UPDATE parks SET lat = NULL, lon = NULL WHERE name = 'Todd Armstrong Shows';
