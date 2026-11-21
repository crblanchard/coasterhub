-- 217: one spelling per manufacturer and per model (Carter, 2026-11-22:
-- "clean up manufacturers/models for consistency because there are a lot of
-- variations in names/spellings"). Only the unambiguous ones: typos, the same
-- company written two ways, a model missing its maker's prefix. The judgement
-- calls (Güven, Beston, Heege, Arrow Development vs Dynamics, PTC's eras,
-- Intamin Motorbike vs Moto Coaster) are left for Carter. Each UPDATE is
-- idempotent: a second run matches nothing. No activity rows: Carter,
-- 2026-11-05, maker/stat fixes "don't need /changes additions".

-- Manufacturers: typos and duplicates, onto the spelling most rows already use.
UPDATE coasters SET manu = 'MACK Rides' WHERE manu = 'MACK RIdes';
UPDATE coasters SET manu = 'Wisdom Rides' WHERE manu = 'Widsom Rides';
UPDATE coasters SET manu = 'Maurer Rides' WHERE manu IN ('Maurer Söhne', 'Maurer Shöne', 'Maurer AGBHS');
UPDATE coasters SET manu = 'Philadelphia Toboggan Coasters' WHERE manu = 'Philidelphia Toboggan Coasters';
UPDATE coasters SET manu = 'Philadelphia Toboggan Company' WHERE manu = 'Philadelphia Toboggan Company, Inc.';
UPDATE coasters SET manu = 'E&F Miler Industries' WHERE manu = 'E&F Miler';
UPDATE coasters SET manu = 'B. A. Schiff & Associates' WHERE manu = 'B. A. Schiff';
UPDATE coasters SET manu = 'DAL Amusement Rides' WHERE manu = 'Dal Rides';
UPDATE coasters SET manu = 'Diego Cavazza' WHERE manu = 'Cavazza Diego';
UPDATE coasters SET manu = 'Robles Bouso Atracciones' WHERE manu = 'Robles Bouso Atracciones Atracciones';
UPDATE coasters SET manu = 'Rocky Mountain Coasters' WHERE manu = 'Rocky Mountain Construction';
UPDATE coasters SET manu = 'RES Rides' WHERE manu = 'Ride Engineers Switzerland';
UPDATE coasters SET manu = 'SDC' WHERE manu = 'S.D.C.';
UPDATE coasters SET manu = 'Sansei Technologies' WHERE manu = 'Sansei';
UPDATE coasters SET manu = 'T. M. Harton' WHERE manu = 'TM Harton Company';
UPDATE coasters SET manu = 'Traver Engineering' WHERE manu = 'Traver Engineering Company';
UPDATE coasters SET manu = 'LaMarcus Adna Thompson' WHERE manu = '(1) LaMarcus Adna Thompson';
UPDATE coasters SET manu = 'John Norman Bartlett' WHERE manu = 'John Norman Bartlett, Euclid Beach Park';
UPDATE coasters SET manu = 'John A. Miller' WHERE manu LIKE 'Andy Vettel,%Kennywood';
UPDATE coasters SET manu = NULL WHERE manu = 'Unknown';

-- Models: the same model written two ways.
UPDATE coasters SET model = 'B&M Flyer' WHERE model = 'B&M Flying';
UPDATE coasters SET model = 'B&M Sitting' WHERE model = 'Sitting Coaster' AND manu = 'Bolliger & Mabillard';
UPDATE coasters SET model = 'S&S El Loco' WHERE model = 'El Loco';
UPDATE coasters SET model = 'Allan Herschell Wild Mouse' WHERE model = 'Herschell Wild Mouse';
UPDATE coasters SET model = 'SDC Hurricane' WHERE model = 'Hurricane' AND manu = 'SDC';
UPDATE coasters SET model = 'Schwarzkopf Jet Star' WHERE model = 'Jet Star' AND manu = 'Schwarzkopf';
UPDATE coasters SET model = 'Zamperla Moto Coaster' WHERE model = 'Zamperla Motocoaster';
UPDATE coasters SET model = 'MACK Powered Coaster' WHERE model = 'Powered Coaster' AND manu = 'MACK Rides';
UPDATE coasters SET model = 'Zamperla Powered' WHERE model = 'Powered Coaster' AND manu = 'Zamperla';
UPDATE coasters SET model = 'Gravity Group Wood' WHERE model = 'Gravity Group';

-- A model named for its maker, on a row with no maker: fill the maker in.
UPDATE coasters SET manu = CASE
    WHEN model LIKE 'Vekoma %' THEN 'Vekoma'
    WHEN model LIKE 'Zierer %' THEN 'Zierer'
    WHEN model LIKE 'Wisdom %' OR model = 'Miner Mike' THEN 'Wisdom Rides'
    WHEN model LIKE 'SBF Visa %' THEN 'SBF Visa'
    WHEN model LIKE 'B&M %' THEN 'Bolliger & Mabillard'
    WHEN model LIKE 'Intamin %' THEN 'Intamin'
    WHEN model LIKE 'Interpark %' THEN 'Interpark'
    WHEN model LIKE 'L&T %' THEN 'L&T Systems'
    WHEN model LIKE 'Preston & Barbieri %' THEN 'Preston & Barbieri'
    WHEN model LIKE 'SDC %' THEN 'SDC'
    WHEN model LIKE 'Wiegand %' THEN 'Wiegand'
    WHEN model LIKE 'Extreme Engineering %' THEN 'Extreme Engineering'
    WHEN model LIKE 'Zamperla %' THEN 'Zamperla'
    WHEN model LIKE 'MACK %' THEN 'MACK Rides'
    WHEN model LIKE 'Gerstlauer %' THEN 'Gerstlauer'
    WHEN model LIKE 'Premier %' THEN 'Premier Rides'
    WHEN model LIKE 'Schwarzkopf %' THEN 'Schwarzkopf'
    WHEN model LIKE 'Arrow %' THEN 'Arrow Dynamics'
    WHEN model LIKE 'S&S %' THEN 'S&S Worldwide'
    WHEN model LIKE 'Maurer %' THEN 'Maurer Rides'
    WHEN model LIKE 'RMC %' THEN 'Rocky Mountain Coasters'
    WHEN model LIKE 'GCI %' THEN 'Great Coasters International'
    WHEN model LIKE 'CCI %' THEN 'Custom Coasters International'
  END
WHERE manu IS NULL AND model IS NOT NULL AND (model LIKE 'Vekoma %' OR model LIKE 'Zierer %' OR model LIKE 'Wisdom %'
  OR model = 'Miner Mike' OR model LIKE 'SBF Visa %' OR model LIKE 'B&M %' OR model LIKE 'Intamin %' OR model LIKE 'Interpark %'
  OR model LIKE 'L&T %' OR model LIKE 'Preston & Barbieri %' OR model LIKE 'SDC %' OR model LIKE 'Wiegand %'
  OR model LIKE 'Extreme Engineering %' OR model LIKE 'Zamperla %' OR model LIKE 'MACK %' OR model LIKE 'Gerstlauer %'
  OR model LIKE 'Premier %' OR model LIKE 'Schwarzkopf %' OR model LIKE 'Arrow %' OR model LIKE 'S&S %'
  OR model LIKE 'Maurer %' OR model LIKE 'RMC %' OR model LIKE 'GCI %' OR model LIKE 'CCI %');
