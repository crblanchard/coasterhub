-- 154: Loup-Garou (Walibi Belgium) closes 2027-01-03 (Carter, 2026-11-06:
-- "1/3/27", read US-style as January 3 — the end of the park's winter season).
-- It had today's date. A future date shows as "Closing soon" (app.js
-- markClosing). A date fix, so no /changes row. Safe to run twice.
UPDATE coasters SET closed = '2027-01-03', closedPrec = 'day' WHERE name = 'Loup-Garou' AND park = 'Walibi Belgium';
