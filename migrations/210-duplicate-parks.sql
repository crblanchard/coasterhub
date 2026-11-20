-- One park under two names, from the 2026-11-19/20 additions (Carter,
-- 2026-11-20: "review all the newly added stuff for where we have multiple
-- park IDs for the same park"). A check of every new park against every park
-- within 1 km or with a near-identical name; these are the certain ones:
--   Brazillian Park Washuzan Highland -> Brazilian Park ... (spelling)
--   Brean Leisure Park  -> Brean Theme Park (its Astro Storm and Bulldog
--                          Coaster were on the site twice; the Wikipedia-only
--                          copies go)
--   Pleasure Beach Blackpool -> Pleasure Beach Resort, Meli Park -> Plopsaland
--   Belgium, Korakuen Yuenchi -> Tokyo Dome City, Luna Park Roma -> Luneur
--   Park, Barry's Amusements -> Curry's Fun Park Portrush (renamed 2015):
--                          old names of the park that is there now
--   Funland Hayling Island -> Funland Amusement Park
--   Six Gun Territory (Philadelphia) -> Six Gun Territory (Willow Grove): one
--                          park, Willow Grove Park, renamed in the 1970s
-- Coasters move, the old name becomes a former name of the park, and a
-- park_merged row goes to /changes, as the admin merge would write. Nobody has
-- ridden any of them. Guarded; a second run does nothing.

INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', source, ref, 0, 'reject', 'duplicate (210)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links WHERE coaster_id IN (3997,3998);
DELETE FROM open_facts WHERE coaster_id IN (3997,3998);
DELETE FROM open_links WHERE coaster_id IN (3997,3998);
DELETE FROM coaster_sources WHERE coaster_id IN (3997,3998);
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (3997,3998);
DELETE FROM coasters WHERE id IN (3997,3998) AND park = 'Brean Leisure Park';
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_merged', m.b, (SELECT COUNT(*) FROM coasters c WHERE c.park = m.a), json_object('from', m.a) FROM m WHERE EXISTS (SELECT 1 FROM parks p WHERE p.name = m.a);
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) UPDATE activity SET detail = json_set(detail, '$.park', (SELECT b FROM m WHERE m.a = json_extract(activity.detail, '$.park'))) WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) UPDATE coasters SET park = (SELECT b FROM m WHERE m.a = coasters.park) WHERE park IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) UPDATE park_aliases SET park = (SELECT b FROM m WHERE m.a = park_aliases.park) WHERE park IN (SELECT a FROM m);
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) SELECT b, a, 'merged', date('now') FROM m WHERE EXISTS (SELECT 1 FROM parks p WHERE p.name = m.a);
WITH m(a, b) AS (VALUES ('Brazillian Park Washuzan Highland', 'Brazilian Park Washuzan Highland'), ('Brean Leisure Park', 'Brean Theme Park'), ('Pleasure Beach Blackpool', 'Pleasure Beach Resort'), ('Meli Park', 'Plopsaland Belgium'), ('Korakuen Yuenchi', 'Tokyo Dome City'), ('Luna Park Roma', 'Luneur Park'), ('Barry''s Amusements', 'Curry''s Fun Park Portrush'), ('Funland Hayling Island', 'Funland Amusement Park'), ('Six Gun Territory (Philadelphia)', 'Six Gun Territory (Willow Grove)')) DELETE FROM parks WHERE name IN (SELECT a FROM m) AND NOT EXISTS (SELECT 1 FROM coasters c WHERE c.park = parks.name);
