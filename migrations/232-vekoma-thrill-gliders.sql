-- 232: Vekoma Thrill Gliders (Carter, 2026-11-24: "call thrill glider at sfmm
-- Race at Futuroscope and Missie Luminar Vekoma Thrill Glider as the model.
-- race opens 2028 missie opens 2029"). Future rides: yr + opened as the year,
-- so the site shows them as Under construction. Filling in a model/date on an
-- existing coaster gets no activity row.
UPDATE coasters SET model = 'Vekoma Thrill Glider' WHERE name = 'Thrill Glider' AND park = 'Six Flags Magic Mountain' AND manu = 'Vekoma';
UPDATE coasters SET model = 'Vekoma Thrill Glider', yr = 2028, opened = '2028', openedPrec = 'year' WHERE name = 'Race' AND park = 'Futuroscope';
UPDATE coasters SET model = 'Vekoma Thrill Glider', yr = 2029, opened = '2029', openedPrec = 'year' WHERE name = 'Missie Luminar' AND park = 'Efteling';
