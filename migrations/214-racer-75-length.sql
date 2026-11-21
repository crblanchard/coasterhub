-- Racer 75 (both sides) was stored as 33,684.4 ft, ten times too long.
-- Carter, 2026-11-21: "correct racer to 3368.5. both sides of it". Cause: German
-- Wikipedia's "je. 1026,7" (1,026.7 m each side) was read as 10,267 m — the
-- "." in "je." disabled the comma-decimal rule (fixed in match-sources.py's
-- dnum the same day; Lightning Racer in 209 was the same bug). Entered by
-- hand, so 'manual'. No /changes row for a fixed stat (Carter, 2026-11-05).
UPDATE coasters SET l = 3368.5 WHERE park = 'Kings Dominion' AND name IN ('Racer 75 (North)', 'Racer 75 (South)');
INSERT OR REPLACE INTO coaster_sources (coaster_id, field, source, ref) SELECT id, 'l', 'manual', NULL FROM coasters WHERE park = 'Kings Dominion' AND name IN ('Racer 75 (North)', 'Racer 75 (South)');
