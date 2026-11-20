-- Thrill Glider (Six Flags Magic Mountain) opens in 2027 (Carter, 2026-11-20:
-- "thrill glider opening date 2027"). A future year shows it as Under
-- construction. Entered by hand, so its source is 'manual'. A filled-in date
-- on an existing coaster gets no /changes row (Carter, 2026-11-05).
UPDATE coasters SET yr = 2027, opened = '2027', openedPrec = 'year' WHERE name = 'Thrill Glider' AND park = 'Six Flags Magic Mountain';
INSERT OR REPLACE INTO coaster_sources (coaster_id, field, source, ref) SELECT id, 'opened', 'manual', NULL FROM coasters WHERE name = 'Thrill Glider' AND park = 'Six Flags Magic Mountain';
