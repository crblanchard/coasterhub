-- 130: an explicit flag for travelling shows. Until now "no coordinates" WAS the
-- flag (app.js traveling(), Carter 2026-10-17). From 2026-11-05 a real park may
-- also be pinless while its location is unconfirmed — Carter: "just wait on
-- locations and keep a list going of places without locations. I'd rather have
-- them not show than be inaccurate" — and that park is not a fair.
-- Every park pinless today is a fair (Butler Amusements, the Family operators,
-- Oscar Bruch...), so they all get the flag. The ALTER errors with "duplicate
-- column" on a second run; that is harmless, and the UPDATE is a no-op.
ALTER TABLE parks ADD COLUMN travel INTEGER;
UPDATE parks SET travel = 1 WHERE (lat IS NULL OR lon IS NULL) AND travel IS NULL;
