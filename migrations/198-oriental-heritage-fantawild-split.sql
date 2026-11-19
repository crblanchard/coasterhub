-- Oriental Heritage and Fantawild Adventure are chains of same-named parks in
-- China. The 2026-11-19 new-park add put one of each on the site, and the
-- Oriental Heritage one (pinned at Changsha) also got rides from Xiamen and
-- Ningbo because the review grouped them by name. Carter, 2026-11-20: name each
-- one "Oriental Heritage (city)" / "Fantawild Adventure (city)" and split them.
--
-- Cities come from each Coasterpedia page's location field and the pins:
--   Oriental Heritage   Changsha (live; Celestial Gauntlet, Big Top: "Ningxiang,
--                       Changsha"), Jinan, Ningbo (Cixi), Xiamen (Tong'an),
--                       Wuhu (Jiujiang)
--   Fantawild Adventure Zhuzhou (live; Stress Express), Zhengzhou, Tai'an
-- Xiamen's pin is the centre of the OSM coaster tracks there; Wuhu's is an
-- estimate (listed in missing-parks.md).
--
-- Nobody has ridden any of these, so no former-name alias is kept for the
-- bare names (it would point at one of five parks). The new coasters at the
-- new parks are added through the Worker afterwards
-- (tools/add-new-parks.mjs --spec tools/open-data/split-198.json), so they get
-- their facts, sources and coaster_added rows the normal way.
-- Every statement is guarded: a second run does nothing.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Oriental Heritage (Changsha)', 2, json_object('from', 'Oriental Heritage') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Oriental Heritage') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Oriental Heritage (Changsha)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Fantawild Adventure (Zhuzhou)', (SELECT COUNT(*) FROM coasters WHERE park = 'Fantawild Adventure'), json_object('from', 'Fantawild Adventure') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Fantawild Adventure') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fantawild Adventure (Zhuzhou)');

INSERT INTO parks (name, lat, lon, region, travel) SELECT v.column1, v.column2, v.column3, 'China', 0 FROM (VALUES
  ('Oriental Heritage (Jinan)', 36.70616, 116.87606),
  ('Oriental Heritage (Ningbo)', 30.31946, 121.17774),
  ('Oriental Heritage (Xiamen)', 24.6808, 118.1668),
  ('Oriental Heritage (Wuhu)', 31.357, 118.391),
  ('Fantawild Adventure (Zhengzhou)', 34.76896, 113.92722),
  ('Fantawild Adventure (Tai''an)', 36.23893, 117.19013)) v
WHERE NOT EXISTS (SELECT 1 FROM parks p WHERE p.name = v.column1);

-- Rides that belong to Xiamen and Ningbo, out of the Changsha park.
UPDATE coasters SET park = 'Oriental Heritage (Xiamen)' WHERE park = 'Oriental Heritage' AND name IN ('Galaxy Express', 'Jungle Trailblazer');
UPDATE coasters SET park = 'Oriental Heritage (Ningbo)' WHERE park = 'Oriental Heritage' AND name = 'Stress Express';

UPDATE parks SET name = 'Oriental Heritage (Changsha)' WHERE name = 'Oriental Heritage';
UPDATE coasters SET park = 'Oriental Heritage (Changsha)' WHERE park = 'Oriental Heritage';
UPDATE parks SET name = 'Fantawild Adventure (Zhuzhou)' WHERE name = 'Fantawild Adventure';
UPDATE coasters SET park = 'Fantawild Adventure (Zhuzhou)' WHERE park = 'Fantawild Adventure';

-- Yesterday's coaster_added rows name the park they went in at: point them at
-- where each coaster is now, so /changes links to the right park.
UPDATE activity SET detail = json_set(detail, '$.park', (SELECT c.park FROM coasters c WHERE c.id = json_extract(activity.detail, '$.id'))) WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') IN ('Oriental Heritage', 'Fantawild Adventure');

-- The other same-name cards on /sources/review are handled here, so they
-- leave the New parks list.
INSERT OR IGNORE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'park', '', k, 0, 'approve', park || ' (split, 198)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_new_parks WHERE park IN ('Oriental Heritage', 'Fantawild Adventure') AND NOT EXISTS (SELECT 1 FROM open_reviews r WHERE r.kind = 'park' AND r.ref = open_new_parks.k);
