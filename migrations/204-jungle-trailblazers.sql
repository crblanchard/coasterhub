-- The seven Jungle Trailblazers (Carter, 2026-11-20: "put some more effort
-- into checking all the jungle trailblazers and making sure they're broken up
-- properly"). Seven identical Gravity Group / Martin & Vleminckx woodies at
-- seven Fantawild parks, one row each on the site. Coasterpedia's seven pages
-- were each linked right; German Wikipedia's were crossed:
--   * "(Fantawild Dreamland, Zhengzhou)" sat on Zhuzhou's (3094), and
--     "(Fantawild Dreamland, Zhuzhou)" on nothing;
--   * "(Oriental Heritage, Ningbo)" sat on Jinan's (3061) (approved on the
--     review page right after Jinan's own page, which it replaced);
--   * Ningbo (3063) and Wuhu (3064) had none.
-- Each page now goes to the coaster at the town it names (the page's
-- location, opening date and length agree with Coasterpedia's page for that
-- coaster): Zhengzhou 3605, Zhuzhou 3094, Jinan 3061, Ningbo 3063, Wuhu 3064.
-- OSM's only mapped track (node 7835875446, "丛林飞龙", at Nanning) goes to
-- Asian Legend's (2480). Every right pairing is recorded as approved and every
-- wrong one the review page still offered as rejected. No site value came
-- from a German page. Guarded; a second run does nothing.

DELETE FROM open_facts WHERE source = 'dewiki' AND coaster_id IN (3605, 3094, 3061, 3063, 3064);
DELETE FROM open_links WHERE source = 'dewiki' AND coaster_id IN (3605, 3094, 3061, 3063, 3064);
DELETE FROM open_links WHERE source = 'osm' AND ref = 'node/7835875446';
INSERT INTO open_links (coaster_id, source, ref, method, added) VALUES
  (3605, 'dewiki', 'Jungle Trailblazer (Fantawild Dreamland, Zhengzhou)', 'approved', date('now')),
  (3094, 'dewiki', 'Jungle Trailblazer (Fantawild Dreamland, Zhuzhou)', 'approved', date('now')),
  (3061, 'dewiki', 'Jungle Trailblazer (Oriental Heritage, Jinan)', 'approved', date('now')),
  (3063, 'dewiki', 'Jungle Trailblazer (Oriental Heritage, Ningbo)', 'approved', date('now')),
  (3064, 'dewiki', 'Jungle Trailblazer (Oriental Heritage, Wuhu)', 'approved', date('now')),
  (2480, 'osm', 'node/7835875446', 'approved', date('now'));
INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved)
  SELECT l.coaster_id, f.field, f.value, f.prec, f.source, f.ref, f.cites_rcdb, date('now') FROM open_links l JOIN open_record_facts f ON f.source = l.source AND f.ref = l.ref
  WHERE (l.source = 'dewiki' AND l.coaster_id IN (3605, 3094, 3061, 3063, 3064)) OR (l.source = 'osm' AND l.ref = 'node/7835875446');
-- Wrong pairings out of the review (every Jungle Trailblazer page against every
-- Jungle Trailblazer coaster), then the right ones approved.
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at)
  SELECT 'match', i.source, i.ref, c.id, 'reject', 'another Jungle Trailblazer (204)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM open_items i JOIN coasters c ON c.name = 'Jungle Trailblazer'
  WHERE i.name = 'Jungle Trailblazer' AND i.source IN ('dewiki', 'coasterpedia')
    AND NOT EXISTS (SELECT 1 FROM open_links l WHERE l.source = i.source AND l.ref = i.ref AND l.coaster_id = c.id);
INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at)
  SELECT 'match', l.source, l.ref, l.coaster_id, 'approve', 'Jungle Trailblazer by town (204)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM open_links l JOIN coasters c ON c.id = l.coaster_id WHERE c.name = 'Jungle Trailblazer' AND l.source IN ('dewiki', 'coasterpedia', 'osm');
