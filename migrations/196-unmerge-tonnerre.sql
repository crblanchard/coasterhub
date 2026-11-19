-- Undoes the Tonnerre half of 195 (Carter, 2026-11-19: "Can you separate
-- again so their total numbers of credits aren't changed?"). Keltan and Felix
-- had both rows on their lists, so the merge took a credit from each. The
-- Turbine half of 195 stays: Psyké Underground had no riders.
-- Ran on D1 2026-11-19, one statement at a time:
--   Tonnerre de Zeus back as id 864, with the values it had just before the
--   merge (all from its approved Wikidata link Q586854, none from RCDB);
--   Keltan's dated ride (2018-07-31, ride id 2963) moved back to it; an
--   undated ride for Felix on it (his folded one); the 'merge' alias on 509
--   and the coaster_merged activity row (id 2002) removed; its open_links,
--   open_facts and coaster_sources rows restored. Re-runnable.
INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT 864, 'Tonnerre de Zeus', 'Parc Astérix', 'Wood', 'Custom Coasters International', NULL, 108.3, 52, 4042, NULL, NULL, 1, NULL, '1997', 'year', NULL, NULL WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE id = 864);
UPDATE rides SET coaster_id = 864 WHERE id = 2963 AND user_slug = 'bugmonster1' AND coaster_id = 509;
INSERT INTO rides (user_slug, coaster_id, d) SELECT 'flx-ksl', 864, NULL WHERE NOT EXISTS (SELECT 1 FROM rides WHERE user_slug = 'flx-ksl' AND coaster_id = 864);
DELETE FROM coaster_aliases WHERE coaster_id = 509 AND former_name = 'Tonnerre de Zeus' AND note = 'merge';
DELETE FROM activity WHERE id = 2002 AND kind = 'coaster_merged' AND subject = 'Tonnerre 2 Zeus';
INSERT OR REPLACE INTO open_links (coaster_id, source, ref, method, added) VALUES (864, 'wikidata', 'Q586854', 'approved', '2026-11-19'), (864, 'osm', 'relation/6267961', 'approved', '2026-11-19');
INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT 864, field, value, prec, source, ref, cites_rcdb, '2026-11-19' FROM open_record_facts WHERE (source = 'wikidata' AND ref = 'Q586854') OR (source = 'osm' AND ref = 'relation/6267961');
INSERT OR REPLACE INTO coaster_sources (coaster_id, field, source, ref) VALUES (864, 'type', 'wikidata', 'Q586854'), (864, 'manu', 'wikidata', 'Q586854'), (864, 'h', 'wikidata', 'Q586854'), (864, 's', 'wikidata', 'Q586854'), (864, 'l', 'wikidata', 'Q586854'), (864, 'opened', 'wikidata', 'Q586854');
