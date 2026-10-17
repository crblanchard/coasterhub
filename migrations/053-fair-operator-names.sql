-- 053: fair operators named the way they trade, for consistency.
--
-- Carter, 2026-10-17, after 052 stripped " (travelling)" and left bare
-- surnames ("Holland" reads as the country, "Hammond" as the town): a company
-- name where the operator trades under one, "<surname> Family" for the
-- showman families. Coasterpedia names them the same way ("Buwalda Family").
--   Bruch -> Oscar Bruch          (Oscar Bruch OHG, Munich; runs Alpina Bahn)
--   Studt -> Studt's Funfairs     (trading as such since 1837, Wales)
--   Lapere/Ropers -> Lapere & Ropers Families
--   Manning -> Manning Family    (left off the first list, same rule)
--   every other surname -> "<surname> Family" (Barth too: "R. Barth und Sohn"
--   is the legal name, nobody calls them that)
-- The US carnivals, Pouzet Group and Axels Nöjesfält already carry company
-- names and stay.
--
-- Each rename is what /api/admin/parks/rename does: activity row first (while
-- the old name can be read), coasters follow, aliases re-pointed, old name
-- kept as a former name. Guarded so a target name that already exists is
-- skipped rather than collided with; a second run finds nothing to do.
--
-- Ice Mountain (Reverchon spinner) was Mellors Group's, but Mellors sold it
-- to UK showman Ryan Crow in 2021 (Coasterpedia). Carter: "yes please move
-- that one". It moves to a new "Crow Family"; Mellors is then empty and goes,
-- like Christmas in the Park in 050. The activity row is the Worker's
-- coaster_edited {id, fields:['park']} shape, written before the move.

WITH m(f, t) AS (VALUES ('Bauermeister', 'Bauermeister Family'), ('Eberhard', 'Eberhard Family'), ('Münch', 'Münch Family'), ('Schneider', 'Schneider Family'), ('Schwerin', 'Schwerin Family'), ('Vorlop', 'Vorlop Family'), ('Wegener', 'Wegener Family'), ('Degousée', 'Degousée Family'), ('Dugast', 'Dugast Family'), ('Jacquier', 'Jacquier Family'), ('Kazazian', 'Kazazian Family'), ('Montalétang', 'Montalétang Family'), ('Troisne', 'Troisne Family'), ('Hammond', 'Hammond Family'), ('Holland', 'Holland Family'), ('Matthews', 'Matthews Family'), ('Buwalda', 'Buwalda Family'), ('Vancraeyenest', 'Vancraeyenest Family'), ('Barth', 'Barth Family'), ('Manning', 'Manning Family'), ('Bruch', 'Oscar Bruch'), ('Studt', 'Studt''s Funfairs'), ('Lapere/Ropers', 'Lapere & Ropers Families')) INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'park_renamed', m.t, (SELECT COUNT(*) FROM coasters c WHERE c.park = m.f), json_object('from', m.f) FROM m JOIN parks p ON p.name = m.f WHERE NOT EXISTS (SELECT 1 FROM parks x WHERE x.name = m.t) AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'park_renamed' AND a.subject = m.t AND json_extract(a.detail, '$.from') = m.f);
WITH m(f, t) AS (VALUES ('Bauermeister', 'Bauermeister Family'), ('Eberhard', 'Eberhard Family'), ('Münch', 'Münch Family'), ('Schneider', 'Schneider Family'), ('Schwerin', 'Schwerin Family'), ('Vorlop', 'Vorlop Family'), ('Wegener', 'Wegener Family'), ('Degousée', 'Degousée Family'), ('Dugast', 'Dugast Family'), ('Jacquier', 'Jacquier Family'), ('Kazazian', 'Kazazian Family'), ('Montalétang', 'Montalétang Family'), ('Troisne', 'Troisne Family'), ('Hammond', 'Hammond Family'), ('Holland', 'Holland Family'), ('Matthews', 'Matthews Family'), ('Buwalda', 'Buwalda Family'), ('Vancraeyenest', 'Vancraeyenest Family'), ('Barth', 'Barth Family'), ('Manning', 'Manning Family'), ('Bruch', 'Oscar Bruch'), ('Studt', 'Studt''s Funfairs'), ('Lapere/Ropers', 'Lapere & Ropers Families')) UPDATE coasters SET park = (SELECT t FROM m WHERE f = coasters.park) WHERE park IN (SELECT f FROM m);
WITH m(f, t) AS (VALUES ('Bauermeister', 'Bauermeister Family'), ('Eberhard', 'Eberhard Family'), ('Münch', 'Münch Family'), ('Schneider', 'Schneider Family'), ('Schwerin', 'Schwerin Family'), ('Vorlop', 'Vorlop Family'), ('Wegener', 'Wegener Family'), ('Degousée', 'Degousée Family'), ('Dugast', 'Dugast Family'), ('Jacquier', 'Jacquier Family'), ('Kazazian', 'Kazazian Family'), ('Montalétang', 'Montalétang Family'), ('Troisne', 'Troisne Family'), ('Hammond', 'Hammond Family'), ('Holland', 'Holland Family'), ('Matthews', 'Matthews Family'), ('Buwalda', 'Buwalda Family'), ('Vancraeyenest', 'Vancraeyenest Family'), ('Barth', 'Barth Family'), ('Manning', 'Manning Family'), ('Bruch', 'Oscar Bruch'), ('Studt', 'Studt''s Funfairs'), ('Lapere/Ropers', 'Lapere & Ropers Families')) UPDATE park_aliases SET park = (SELECT t FROM m WHERE f = park_aliases.park) WHERE park IN (SELECT f FROM m);
WITH m(f, t) AS (VALUES ('Bauermeister', 'Bauermeister Family'), ('Eberhard', 'Eberhard Family'), ('Münch', 'Münch Family'), ('Schneider', 'Schneider Family'), ('Schwerin', 'Schwerin Family'), ('Vorlop', 'Vorlop Family'), ('Wegener', 'Wegener Family'), ('Degousée', 'Degousée Family'), ('Dugast', 'Dugast Family'), ('Jacquier', 'Jacquier Family'), ('Kazazian', 'Kazazian Family'), ('Montalétang', 'Montalétang Family'), ('Troisne', 'Troisne Family'), ('Hammond', 'Hammond Family'), ('Holland', 'Holland Family'), ('Matthews', 'Matthews Family'), ('Buwalda', 'Buwalda Family'), ('Vancraeyenest', 'Vancraeyenest Family'), ('Barth', 'Barth Family'), ('Manning', 'Manning Family'), ('Bruch', 'Oscar Bruch'), ('Studt', 'Studt''s Funfairs'), ('Lapere/Ropers', 'Lapere & Ropers Families')) INSERT OR IGNORE INTO park_aliases (park, former_name, note, added) SELECT m.t, m.f, 'renamed', date('now') FROM m JOIN parks p ON p.name = m.f;
DELETE FROM park_aliases WHERE park = former_name;
WITH m(f, t) AS (VALUES ('Bauermeister', 'Bauermeister Family'), ('Eberhard', 'Eberhard Family'), ('Münch', 'Münch Family'), ('Schneider', 'Schneider Family'), ('Schwerin', 'Schwerin Family'), ('Vorlop', 'Vorlop Family'), ('Wegener', 'Wegener Family'), ('Degousée', 'Degousée Family'), ('Dugast', 'Dugast Family'), ('Jacquier', 'Jacquier Family'), ('Kazazian', 'Kazazian Family'), ('Montalétang', 'Montalétang Family'), ('Troisne', 'Troisne Family'), ('Hammond', 'Hammond Family'), ('Holland', 'Holland Family'), ('Matthews', 'Matthews Family'), ('Buwalda', 'Buwalda Family'), ('Vancraeyenest', 'Vancraeyenest Family'), ('Barth', 'Barth Family'), ('Manning', 'Manning Family'), ('Bruch', 'Oscar Bruch'), ('Studt', 'Studt''s Funfairs'), ('Lapere/Ropers', 'Lapere & Ropers Families')) UPDATE parks SET name = (SELECT t FROM m WHERE f = parks.name) WHERE name IN (SELECT f FROM m) AND NOT EXISTS (SELECT 1 FROM parks x WHERE x.name = (SELECT t FROM m WHERE f = parks.name));
INSERT INTO parks (name, lat, lon, region) SELECT 'Crow Family', NULL, NULL, 'United Kingdom' WHERE NOT EXISTS (SELECT 1 FROM parks WHERE name = 'Crow Family');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', c.name, 1, json_object('id', c.id, 'fields', json_array('park'), 'via', '053') FROM coasters c WHERE c.name = 'Ice Mountain' AND c.park = 'Mellors';
UPDATE coasters SET park = 'Crow Family' WHERE name = 'Ice Mountain' AND park = 'Mellors' AND EXISTS (SELECT 1 FROM parks WHERE name = 'Crow Family');
DELETE FROM park_aliases WHERE park = 'Mellors' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Mellors');
DELETE FROM parks WHERE name = 'Mellors' AND NOT EXISTS (SELECT 1 FROM coasters WHERE park = 'Mellors');
