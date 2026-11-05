-- 134: real coordinates from Carter (Google Maps, 2026-11-05) for 12 of the 15
-- parks on estimated pins (missing-parks.md). His paste had Rocky Mountain
-- Pumpkin Ranch and Santa's Workshop swapped — 38.905,-104.977 is by Cascade /
-- Pikes Peak (Santa's Workshop) and 40.204,-105.141 is Longmont (the ranch) — so
-- they are assigned that way round. Korea's three still wait: Google Maps gives
-- no coordinates there. Park coordinate edits write no activity row (the
-- Worker's PUT /api/park doesn't either). Safe to run twice.
UPDATE parks SET
  lat = CASE name
    WHEN 'Aspen Snowmass Ski Resort' THEN 39.186763
    WHEN 'Breckenridge Ski Resort' THEN 39.480145
    WHEN 'City Park (Pueblo)' THEN 38.265460
    WHEN 'Fun City' THEN 40.371469
    WHEN 'Malibu Jack''s' THEN 39.878519
    WHEN 'Mile High Flea Market' THEN 39.858851
    WHEN 'Mustang Mountain Coaster' THEN 40.390962
    WHEN 'Rocky Mountain Pumpkin Ranch' THEN 40.203804
    WHEN 'Santa''s Workshop' THEN 38.904950
    WHEN 'Vail Adventure Ridge' THEN 39.618549
    WHEN 'Hong Kong Disneyland' THEN 22.313125
    WHEN 'Ocean Park' THEN 22.234243 END,
  lon = CASE name
    WHEN 'Aspen Snowmass Ski Resort' THEN -106.935047
    WHEN 'Breckenridge Ski Resort' THEN -106.067630
    WHEN 'City Park (Pueblo)' THEN -104.658246
    WHEN 'Fun City' THEN -105.524975
    WHEN 'Malibu Jack''s' THEN -104.985368
    WHEN 'Mile High Flea Market' THEN -104.906991
    WHEN 'Mustang Mountain Coaster' THEN -105.485555
    WHEN 'Rocky Mountain Pumpkin Ranch' THEN -105.141123
    WHEN 'Santa''s Workshop' THEN -104.977300
    WHEN 'Vail Adventure Ridge' THEN -106.388821
    WHEN 'Hong Kong Disneyland' THEN 114.041067
    WHEN 'Ocean Park' THEN 114.170844 END
WHERE name IN ('Aspen Snowmass Ski Resort','Breckenridge Ski Resort','City Park (Pueblo)','Fun City','Malibu Jack''s','Mile High Flea Market','Mustang Mountain Coaster','Rocky Mountain Pumpkin Ranch','Santa''s Workshop','Vail Adventure Ridge','Hong Kong Disneyland','Ocean Park');
