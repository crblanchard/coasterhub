-- 230: every model carries its maker's name unless several makers build it
-- (Carter, 2026-11-24: "update models to include manufacturer name as
-- relevant. only ones that shouldn't are generic where multiple manufacturers
-- make them"). After 217/224/225 only four single-maker models lacked it.
-- Generic, several makers, unchanged: Kiddie, Wood, Wacky Worm, Indoor, Mine
-- Train, Racer, Family, Dark Ride, Jet Coaster, Bobsled. Rows with no maker
-- keep their model as is. 216's category list is updated to match.
UPDATE coasters SET model = 'Wisdom Miner Mike' WHERE model = 'Miner Mike' AND manu = 'Wisdom Rides';
UPDATE coasters SET model = 'Sunkid Alpine' WHERE model = 'Alpine' AND manu = 'Sunkid';
UPDATE coasters SET model = 'Maurer Family Launch' WHERE model = 'Family Launch' AND manu = 'Maurer Rides';
UPDATE coasters SET model = 'Arrow Hybrid' WHERE model = 'Hybrid' AND manu = 'Arrow Dynamics';
