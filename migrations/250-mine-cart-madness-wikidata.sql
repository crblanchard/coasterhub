-- Wikidata's Mine-Cart Madness (Q137998869, no park on the item) was never
-- linked. Its photos are labelled Universal Epic Universe, so it belongs to
-- that row, not Universal Studios Japan's (linked there first by mistake on
-- 2026-11-26 while checking the one Global top-100 coaster with no photo,
-- then moved). USJ's still has no photo in the open sources.
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT id, 'wikidata', 'Q137998869', 'approved', '2026-11-26' FROM coasters WHERE name = 'Mine-Cart Madness' AND park = 'Universal Epic Universe';
DELETE FROM open_links WHERE source = 'wikidata' AND ref = 'Q137998869' AND coaster_id = (SELECT id FROM coasters WHERE name = 'Mine Cart Madness' AND park = 'Universal Studios Japan');
