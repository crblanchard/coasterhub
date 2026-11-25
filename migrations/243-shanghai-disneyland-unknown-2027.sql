-- Shanghai Disneyland's "Unknown" opens in 2027 (Carter, 2026-11-25). It had
-- no year at all, so it counted as an operating credit; with yr/opened 2027
-- it reads Under construction and the trip planner shows it "Opening 2027".
-- A filled-in date gets no /changes row (Carter, 2026-11-05).
UPDATE coasters SET yr = 2027, opened = '2027', openedPrec = 'year' WHERE park = 'Shanghai Disneyland' AND name = 'Unknown' AND opened IS NULL;
