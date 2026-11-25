-- Diavlo (Himeji Central Park) was never linked to its Wikidata item (Q3026440,
-- "Diavlo", no park on the item, so the matching passed it by), which keeps
-- its Commons photos off the coaster (Carter, 2026-11-26, from its Change photo
-- grid). Linked by hand.
INSERT OR IGNORE INTO open_links (coaster_id, source, ref, method, added) SELECT id, 'wikidata', 'Q3026440', 'approved', '2026-11-26' FROM coasters WHERE name = 'Diavlo' AND park = 'Himeji Central Park';
