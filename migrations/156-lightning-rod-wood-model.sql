-- 156: Dollywood's original Lightning Rod (wood, 2016-2020) goes under the
-- "RMC Wood" model (Carter, 2026-11-06). A fill-in, no /changes row.
UPDATE coasters SET model = 'RMC Wood' WHERE name = 'Lightning Rod (Wood, 2016-2020)' AND park = 'Dollywood' AND model IS NULL;
