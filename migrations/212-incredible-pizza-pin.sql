-- St. Louis' Incredible Pizza Company: the merge in 211 kept the new park's
-- pin, which was a town estimate in downtown St. Louis; the old park's pin
-- (about 18 km south-west) is the restaurant. Carter, 2026-11-20: "use the
-- actual then".
UPDATE parks SET lat = 38.528000110613206, lon = -90.36613830235817 WHERE name = 'St. Louis'' Incredible Pizza Company';
