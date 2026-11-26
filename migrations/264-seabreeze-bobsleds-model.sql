-- Bobsleds at Seabreeze carried model "PTC Wood" with no maker on a steel ride;
-- Carter, 2026-11-26: "remove the model". Idempotent.
UPDATE coasters SET model = NULL WHERE name = 'Bobsleds' AND park = 'Seabreeze' AND model = 'PTC Wood';
