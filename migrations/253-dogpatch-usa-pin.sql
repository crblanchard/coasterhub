-- Dogpatch USA's pin sat in San Francisco's Dogpatch neighbourhood
-- (37.7607, -122.3892). The park was in Arkansas, near Harrison: Carter,
-- 2026-11-26, 36°06'24"N 93°07'56"W = 36.106667, -93.132222. Idempotent.
UPDATE parks SET lat = 36.106667, lon = -93.132222 WHERE name = 'Dogpatch USA';
