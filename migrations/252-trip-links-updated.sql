-- When a saved trip was last edited, so Open a trip on /trip lists the most
-- recently edited first (Carter, 2026-11-26: "sort trips by last edited").
-- worker.js writes it on Save changes and orders by COALESCE(updated, created);
-- before this runs it falls back to created. Run once: ADD COLUMN has no IF
-- NOT EXISTS in SQLite, so a second run errors "duplicate column", harmlessly.
ALTER TABLE trip_links ADD COLUMN updated TEXT;
