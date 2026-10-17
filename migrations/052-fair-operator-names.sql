-- 052: drop " (travelling)" from the end of every fair operator's name.
--
-- Carter, 2026-10-17: "can you remove (travelling) from the end of all the
-- fair operators". Since 050/051 a park with no coordinates is labelled
-- "Fair operator" on its page and on /parks, so the suffix now says the same
-- thing twice. 25 parks, all European family shows (Barth, Buwalda, Manning
-- ...); checked live first: none of the bare names is already a park or a
-- coaster's park, so nothing merges.
--
-- This is what /api/admin/parks/rename does for each one, done in bulk:
-- coasters follow the park, existing aliases are re-pointed, the old name
-- becomes a former name (so imports and old links still find it), and a
-- park_renamed row goes to /changes. The activity rows come FIRST, while the
-- old names can still be read. Every statement matches on the suffix, so a
-- second run finds nothing to do.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', substr(p.name, 1, length(p.name) - 13), (SELECT COUNT(*) FROM coasters c WHERE c.park = p.name), json_object('from', p.name) FROM parks p WHERE p.name LIKE '% (travelling)' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'park_renamed' AND json_extract(a.detail, '$.from') = p.name);
UPDATE coasters SET park = substr(park, 1, length(park) - 13) WHERE park LIKE '% (travelling)';
UPDATE park_aliases SET park = substr(park, 1, length(park) - 13) WHERE park LIKE '% (travelling)';
INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) SELECT substr(name, 1, length(name) - 13), name, 'renamed', date('now') FROM parks WHERE name LIKE '% (travelling)';
DELETE FROM park_aliases WHERE park = former_name;
UPDATE parks SET name = substr(name, 1, length(name) - 13) WHERE name LIKE '% (travelling)';

-- Fun Time Shows: three coasters (Crazy Cobra, Wacky Worm, Orient Express) but
-- no parks row at all, so the "Fair operator" label (no coordinates on a row
-- that exists) never reached it. Found while checking this rename for orphans.
-- No region on file; it can be set from /edit.
INSERT INTO parks (name, lat, lon, region) SELECT 'Fun Time Shows', NULL, NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Fun Time Shows');
