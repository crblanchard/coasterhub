-- 160: Ratanga Junction (Cape Town, closed 2018), with Carter's coordinates and
-- RCDB screenshots, 2026-11-06. A defunct park: three coasters, all removed.
--   Bushwacker (Vekoma Junior 335m, 1998 to 2018-05-01) = Mer de Sable's Silver
--     Mountain, linked; Silver Mountain (runs now) is the home and gets the
--     model and stats it was missing.
--   Cobra (Vekoma SLC 765m w/helix, 1998 to 2018-05-01; "Cape Cobras" from
--     2010) = Lost Island's Nopuku, linked, Nopuku the home. Into Vekoma SLCs.
--   Diamond Devil Run (Vekoma mine train 785m, 1998-2014); its later home,
--     Fantasilandia (as Tren Minero), is not in the database.
-- Safe to run twice.
INSERT INTO parks (name, lat, lon, region, travel) SELECT 'Ratanga Junction', -33.896808, 18.507070, 'South Africa', 0 WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Ratanga Junction');
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, yr, opened, openedPrec, closed, closedPrec, laps) SELECT (SELECT MAX(id) FROM coasters) + ROW_NUMBER() OVER (), v.* FROM (VALUES
 ('Bushwacker','Ratanga Junction','Steel','Vekoma','Vekoma Junior Coaster',42.7,28.5,1099.1,0,60,1998,'1998','year','2018-05-01','day',1),
 ('Cobra','Ratanga Junction','Steel','Vekoma','Vekoma Suspended Looping Coaster',109.3,49.7,2509.8,5,90,1998,'1998','year','2018-05-01','day',1),
 ('Diamond Devil Run','Ratanga Junction','Steel','Vekoma','Mine Train',45.9,30.1,2575.5,0,180,1998,'1998','year','2014-06-01','year',1)
) v WHERE NOT EXISTS (SELECT 1 FROM coasters c WHERE c.name = v.column1 AND c.park = v.column2);
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.park = 'Ratanga Junction' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND json_extract(a.detail, '$.id') = c.id) ORDER BY c.id;
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, 'Cape Cobras', 'rcdb', date('now') FROM coasters WHERE park = 'Ratanga Junction' AND name = 'Cobra';
INSERT OR IGNORE INTO clone_members (coaster, group_id) SELECT c.id, g.id FROM coasters c, clone_groups g WHERE c.park = 'Ratanga Junction' AND c.name = 'Cobra' AND g.name = 'Vekoma SLCs' AND NOT EXISTS (SELECT 1 FROM clone_members m WHERE m.coaster = c.id);
UPDATE coasters SET manu = COALESCE(manu, 'Vekoma'), model = COALESCE(model, 'Vekoma Junior Coaster'), h = COALESCE(h, 42.7), s = COALESCE(s, 28.5), l = COALESCE(l, 1099.1), inv = COALESCE(inv, 0) WHERE park = 'Mer de Sable' AND name = 'Silver Mountain';
INSERT OR IGNORE INTO same_ride (coaster, ride) SELECT c.id, h.id FROM coasters c, coasters h WHERE
 (h.name = 'Silver Mountain' AND h.park = 'Mer de Sable' AND (c.id = h.id OR (c.name = 'Bushwacker' AND c.park = 'Ratanga Junction'))) OR
 (h.name = 'Nopuku' AND h.park = 'Lost Island Theme Park' AND (c.id = h.id OR (c.name = 'Cobra' AND c.park = 'Ratanga Junction')));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'same_ride_set', h.name, (SELECT COUNT(*) FROM same_ride s WHERE s.ride = h.id), json_object('ride', h.id, 'at', (SELECT json_group_array(json_object('id', c.id, 'park', c.park, 'name', c.name)) FROM coasters c JOIN same_ride s ON s.coaster = c.id WHERE s.ride = h.id), 'via', '160') FROM coasters h WHERE ((h.name = 'Silver Mountain' AND h.park = 'Mer de Sable') OR (h.name = 'Nopuku' AND h.park = 'Lost Island Theme Park')) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'same_ride_set' AND json_extract(a.detail, '$.ride') = h.id);
