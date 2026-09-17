-- 011 — name the three 4D models so a row reads on its own
--
-- The count and ranking rows show a coaster's MODEL now rather than
-- "manufacturer model": most models already carry the maker's name ("RMC
-- Hybrid"), so the pair read as a stutter — "Rocky Mountain Construction RMC
-- Hybrid". That change made the 4D coasters the odd ones out. Their model was
-- the bare string "4D", which says nothing standing on its own, and Dinoconda
-- had neither field filled at all.
--
-- So the maker's name goes INTO the model for these three, which is how the
-- rest of the table already reads.
--
-- Matched on name + park, never on an id read off a snapshot — ids move when
-- coasters are merged, names and parks are what a person can check.
--
-- Re-running is a no-op: each statement sets a value it has already set.
-- Nothing else is touched; `manu` is left exactly as it is.

UPDATE coasters SET model = 'S&S 4D'
 WHERE name = 'Eejanaika' AND park = 'Fuji-Q Highland';

UPDATE coasters SET model = 'S&S 4D'
 WHERE name = 'Dinoconda' AND park = 'China Dinosaurs Park';

UPDATE coasters SET model = 'Arrow 4D'
 WHERE name = 'X2'        AND park = 'Six Flags Magic Mountain';
