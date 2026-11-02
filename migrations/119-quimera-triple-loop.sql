-- 119: Quimera (Aztlán Parque Urbano / La Feria Chapultepec, 2007 to 28 Sep
-- 2019) is the Schwarzkopf triple looper that reopened at Indiana Beach as All
-- American Triple Loop on 11 May 2024 - same 3,379.3 ft track (Carter,
-- 2026-11-02: "quimera and all american triple loop are the same"). Linked as
-- one ride, home = Indiana Beach. Quimera's 2 riders keep their credit; it now
-- counts once if they ride it in Indiana too. Safe to run twice.
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE h.name = 'All American Triple Loop' AND h.park = 'Indiana Beach' AND (c.id = h.id OR (c.name = 'Quimera' AND c.park = 'Aztlán Parque Urbano'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '119') FROM coasters h WHERE h.name = 'All American Triple Loop' AND h.park = 'Indiana Beach' AND (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id) > 1 AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND a.detail LIKE '%"via":"119"%');
