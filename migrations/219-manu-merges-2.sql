-- 219: the judgement calls from 217, answered (Carter, 2026-11-22: "1 4 5 6 7
-- yes please. 2 and 3 ... use your judgment"). Each onto the name most rows
-- already carry. Beston: Henan Beston Rides Co., Ltd is the legal name of the
-- company that trades as Beston Amusement Equipment. Heege: Inno-Heege is the
-- later name of Heege Freizeittechnik. Idempotent; no activity rows.
UPDATE coasters SET manu = 'Güven Amusement Rides Factory' WHERE manu = 'Güven Lunapark';
UPDATE coasters SET manu = 'Beston Amusement Equipment' WHERE manu = 'Henan Beston Rides Co., Ltd';
UPDATE coasters SET manu = 'Heege Freizeittechnik' WHERE manu = 'Inno-Heege';
UPDATE coasters SET manu = 'Philadelphia Toboggan Coasters' WHERE manu = 'Philadelphia Toboggan Company';
UPDATE coasters SET manu = 'Arrow Dynamics' WHERE manu = 'Arrow Development';
UPDATE coasters SET model = 'Intamin Moto Coaster' WHERE model = 'Intamin Motorbike';
UPDATE coasters SET manu = 'E&F Miler Industries' WHERE manu = 'Miler Manufacturing';
