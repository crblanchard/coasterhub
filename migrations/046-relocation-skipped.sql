-- 046: relocation triage (2026-10-17). /edit's Relocations tab proposes pairs
-- of coasters that look like one ride that moved parks (same maker and model,
-- one closed, the other opened at another park within four years, height and
-- length within 3%). "Link" writes same_ride (023); "Not the same" lands here
-- so the pair is not proposed again. `a` is the earlier (closed) row, `b` the
-- later one, as the list gives them. No foreign keys (D1 has them off); a row
-- whose coaster is later deleted is harmless — that pair can no longer be
-- proposed anyway. Safe to run twice.
CREATE TABLE IF NOT EXISTS relocation_skipped (
  a  INTEGER NOT NULL,
  b  INTEGER NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (a, b)
);
