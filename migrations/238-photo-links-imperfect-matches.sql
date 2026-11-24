-- Wikidata items that never linked because their name differs from ours
-- (Carter, 2026-11-24: "how do we make photos cooperate for imperfect
-- matches ... for all racing coasters"). Found by matching each unlinked
-- Wikidata item's label, aliases and Commons category against our names,
-- our names minus a racing side ("Racer 75 (North)" -> "Racer 75") and our
-- former names, at the same park. Each one checked by its Commons file names.
--   Q7302076  "Rebel Yell"  -> Racer 75 (North) and (South), Kings Dominion
--             (Wikidata still has the old name; its category is Racer 75)
--   Q61945038 "Mako"        -> Emperor, SeaWorld San Diego (Wikidata's label
--             is wrong; every file is "Emperor (SeaWorld San Diego)")
--   Q1189847  (no label)    -> Top Thrill Dragster, Cedar Point
--   Q1426900  (no label)    -> Super Splash, Tusenfryd
--   Q25395319 (no label)    -> Timber, Walibi Rhône-Alpes
-- Racing pairs otherwise already share one item per pair (77 sides checked:
-- no side lacks photos its partner has). Rows matched by name + park.
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT c.id, 'wikidata', v.column3, 'approved', '2026-11-24' FROM (VALUES ('Racer 75 (North)','Kings Dominion','Q7302076'), ('Racer 75 (South)','Kings Dominion','Q7302076'), ('Emperor','SeaWorld San Diego','Q61945038'), ('Top Thrill Dragster','Cedar Point','Q1189847'), ('Super Splash','Tusenfryd','Q1426900'), ('Timber','Walibi Rhône-Alpes','Q25395319')) v JOIN coasters c ON c.name = v.column1 AND c.park = v.column2;

-- open_images keeps every image of an item, not one per (source, ref, kind):
-- the key gains the file (run live 2026-11-24; build-images-sql.py matches).
CREATE TABLE IF NOT EXISTS open_images_new (source TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, file TEXT NOT NULL DEFAULT '', url TEXT, thumb TEXT, width INTEGER, height INTEGER, author TEXT, license TEXT, license_url TEXT, nonfree INTEGER NOT NULL DEFAULT 0, page TEXT, retrieved TEXT, PRIMARY KEY (source, ref, kind, file));
INSERT OR REPLACE INTO open_images_new SELECT source, ref, kind, COALESCE(file,''), url, thumb, width, height, author, license, license_url, nonfree, page, retrieved FROM open_images;
DROP TABLE open_images;
ALTER TABLE open_images_new RENAME TO open_images;
