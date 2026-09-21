-- 021: coaster stats Carter reads off RCDB, park by park (started 2026-09-21, from
-- the parks-stats.csv list of what is blank). A block per park, appended as he
-- sends them, so this file keeps growing and each block can be pasted alone.
-- RCDB is the source he chose, so these SET the value (not COALESCE): a wrong
-- number already in the row should lose to it. Matched on name + park. Feet,
-- mph, and the year-precision date convention the rows already use: an
-- opening or closing known only to the year is stored as YYYY-06-01 with
-- Prec = 'year'. Manufacturer and model use the spellings /edit already has
-- (E&F Miler / Miler Wild Mouse, not RCDB's "Miler Manufacturing / Wild Mouse").

-- ---- Adventure City (Anaheim) ----
-- Rewind Racers and Freeway Coaster already carried what RCDB shows (RCDB has
-- no numbers at all for Freeway). Tree Top Racers was an empty row and was
-- counted as operating; RCDB: Miler wild mouse, 900 ft, 35 ft, 0 inversions,
-- operated 1999-2012, SBNO 2013, removed.
UPDATE coasters SET type = 'Steel', manu = 'E&F Miler', model = 'Miler Wild Mouse', h = 35, l = 900, inv = 0,
  yr = 1999, opened = '1999-06-01', openedPrec = 'year', closed = '2012-06-01', closedPrec = 'year'
  WHERE name = 'Tree Top Racers' AND park = 'Adventure City';
