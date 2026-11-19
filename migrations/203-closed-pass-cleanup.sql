-- Clean-up after the 2026-11-19 closed-coaster pass (562 parks, 808 coasters
-- through add-new-parks.yml with closed=yes). A check of every new park
-- within 1.2 km of another, and a read of the list, found:
--   * one park under two Coasterpedia/Wikipedia names, so some rides twice:
--     Sea World / Sea World (Australia) (Jet Rescue, Storm Coaster),
--     Happy Valley (Beijing) / Happy Valley Beijing (Crystal Wing, Golden
--     Wings), Crystal Beach / Crystal Beach Park (Cyclone), Parque de la
--     Ciudad (Buenos Aires) / (Villa Soldati);
--   * old names of parks we have, as their own parks: Marriott's Great
--     America (Gurnee) = Six Flags Great America, (Santa Clara) =
--     California's Great America, Fantasy Island (Grand Island) = Niagara
--     Amusement Park & Splash World (and pinned in Nebraska);
--   * a travelling showman, Xavier Lapère (fairs wait for their own pass).
-- The second copy of each ride (the Wikipedia-only one) is deleted, with its
-- links, sources and /changes row, and its page marked "not added" so the
-- review does not offer it again; parks merge into the one we keep. Nobody
-- has ridden any of them. Guarded; a second run does nothing.

INSERT OR REPLACE INTO open_reviews (kind, source, ref, coaster_id, decision, note, by, at) SELECT 'add', source, ref, 0, 'reject', 'duplicate or fair (203)', 'migration', strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM open_links WHERE coaster_id IN (3298,3299,3257,3258,3563,3971);
DELETE FROM open_facts WHERE coaster_id IN (3298,3299,3257,3258,3563,3971);
DELETE FROM open_links WHERE coaster_id IN (3298,3299,3257,3258,3563,3971);
DELETE FROM coaster_sources WHERE coaster_id IN (3298,3299,3257,3258,3563,3971);
DELETE FROM activity WHERE kind = 'coaster_added' AND json_extract(detail, '$.id') IN (3298,3299,3257,3258,3563,3971);
DELETE FROM coasters WHERE id IN (3298,3299,3257,3258,3563,3971);
DELETE FROM parks WHERE name = 'Xavier Lapère (Travelling)' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Xavier Lapère (Travelling)');
UPDATE activity SET detail = json_set(detail, '$.park', 'Six Flags Great America') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Marriott''s Great America (Gurnee)';
UPDATE coasters SET park = 'Six Flags Great America' WHERE park = 'Marriott''s Great America (Gurnee)';
DELETE FROM parks WHERE name = 'Marriott''s Great America (Gurnee)' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Six Flags Great America');
UPDATE activity SET detail = json_set(detail, '$.park', 'California''s Great America') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Marriott''s Great America (Santa Clara)';
UPDATE coasters SET park = 'California''s Great America' WHERE park = 'Marriott''s Great America (Santa Clara)';
DELETE FROM parks WHERE name = 'Marriott''s Great America (Santa Clara)' AND EXISTS (SELECT 1 FROM parks WHERE name = 'California''s Great America');
UPDATE activity SET detail = json_set(detail, '$.park', 'Niagara Amusement Park & Splash World') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Fantasy Island (Grand Island)';
UPDATE coasters SET park = 'Niagara Amusement Park & Splash World' WHERE park = 'Fantasy Island (Grand Island)';
DELETE FROM parks WHERE name = 'Fantasy Island (Grand Island)' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Niagara Amusement Park & Splash World');
UPDATE activity SET detail = json_set(detail, '$.park', 'Sea World') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Sea World (Australia)';
UPDATE coasters SET park = 'Sea World' WHERE park = 'Sea World (Australia)';
DELETE FROM parks WHERE name = 'Sea World (Australia)' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Sea World');
UPDATE activity SET detail = json_set(detail, '$.park', 'Happy Valley (Beijing)') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Happy Valley Beijing';
UPDATE coasters SET park = 'Happy Valley (Beijing)' WHERE park = 'Happy Valley Beijing';
DELETE FROM parks WHERE name = 'Happy Valley Beijing' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Happy Valley (Beijing)');
UPDATE activity SET detail = json_set(detail, '$.park', 'Crystal Beach Park') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Crystal Beach';
UPDATE coasters SET park = 'Crystal Beach Park' WHERE park = 'Crystal Beach';
DELETE FROM parks WHERE name = 'Crystal Beach' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Crystal Beach Park');
UPDATE activity SET detail = json_set(detail, '$.park', 'Parque de la Ciudad (Villa Soldati)') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Parque de la Ciudad (Buenos Aires)';
UPDATE coasters SET park = 'Parque de la Ciudad (Villa Soldati)' WHERE park = 'Parque de la Ciudad (Buenos Aires)';
DELETE FROM parks WHERE name = 'Parque de la Ciudad (Buenos Aires)' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de la Ciudad (Villa Soldati)');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', 'Parque de la Ciudad', 5, json_object('from', 'Parque de la Ciudad (Villa Soldati)') WHERE EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de la Ciudad (Villa Soldati)') AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de la Ciudad');
UPDATE parks SET name = 'Parque de la Ciudad' WHERE name = 'Parque de la Ciudad (Villa Soldati)' AND NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Parque de la Ciudad');
UPDATE coasters SET park = 'Parque de la Ciudad' WHERE park = 'Parque de la Ciudad (Villa Soldati)';
UPDATE activity SET detail = json_set(detail, '$.park', 'Parque de la Ciudad') WHERE kind = 'coaster_added' AND json_extract(detail, '$.park') = 'Parque de la Ciudad (Villa Soldati)';
