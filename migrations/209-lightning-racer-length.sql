-- Lightning Racer (both sides) was stored as 33,930.4 ft long, ten times too
-- long, which made it the "longest coaster" on the site. Carter, 2026-11-20:
-- "make it 3393 for both sides". Entered by hand, so 'manual'. A fixed stat
-- on an existing coaster gets no /changes row (Carter, 2026-11-05).
UPDATE coasters SET l = 3393 WHERE park = 'Hersheypark' AND name IN ('Lightning Racer (Thunder)', 'Lightning Racer (Lightning)');
INSERT OR REPLACE INTO coaster_sources (coaster_id, field, source, ref) SELECT id, 'l', 'manual', NULL FROM coasters WHERE park = 'Hersheypark' AND name IN ('Lightning Racer (Thunder)', 'Lightning Racer (Lightning)');
