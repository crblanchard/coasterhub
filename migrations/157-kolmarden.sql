-- 157: Kolmården (Sweden), from Carter's RCDB screenshots and coordinates,
-- 2026-11-06. Fill-ins, no /changes rows. Wildfire goes under "RMC Wood"
-- (Carter: "another rmc wood"; RCDB: Topper Track, custom).
--   Delfinexpressen: Vekoma Junior 335m, 42.7 ft, 28.5 mph, 1,099.1 ft, 1:06,
--     2009-05-01. Godiståget: Zierer Force 190, 26.2 ft, 24.9 mph, 629.9 ft,
--     2015-05-01. Wildfire: 183.8 ft, 71.5 mph, 4,150.3 ft, 3 inv, 2:00,
--     2016-06-28.
-- The park's pin was ~6 km off; Carter's coordinates replace it.
UPDATE parks SET lat = 58.665209, lon = 16.465583 WHERE name = 'Kolmården';
UPDATE coasters SET manu = COALESCE(manu, 'Vekoma'), model = COALESCE(model, 'Vekoma Junior Coaster'), h = COALESCE(h, 42.7), s = COALESCE(s, 28.5), l = COALESCE(l, 1099.1), inv = COALESCE(inv, 0), dur = COALESCE(dur, 66), yr = COALESCE(yr, 2009), opened = COALESCE(opened, '2009-05-01'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Kolmården' AND name = 'Delfinexpressen';
UPDATE coasters SET manu = COALESCE(manu, 'Zierer'), model = COALESCE(model, 'Zierer Force'), h = COALESCE(h, 26.2), s = COALESCE(s, 24.9), l = COALESCE(l, 629.9), inv = COALESCE(inv, 0), yr = COALESCE(yr, 2015), opened = COALESCE(opened, '2015-05-01'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Kolmården' AND name = 'Godiståget';
UPDATE coasters SET manu = COALESCE(manu, 'Rocky Mountain Coasters'), model = COALESCE(model, 'RMC Wood'), type = 'Wood', h = COALESCE(h, 183.8), s = COALESCE(s, 71.5), l = COALESCE(l, 4150.3), inv = COALESCE(inv, 3), dur = COALESCE(dur, 120), yr = COALESCE(yr, 2016), opened = COALESCE(opened, '2016-06-28'), openedPrec = COALESCE(openedPrec, 'day') WHERE park = 'Kolmården' AND name = 'Wildfire';
