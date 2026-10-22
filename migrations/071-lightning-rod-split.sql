-- 071: undo 037's Lightning Rod merge — two credits again.
--
-- Carter, 2026-10-22: "Revert so we have both please. Call them Lightning Rod
-- (Old/Wood) for the old one and Lightning Rod (New/I-Box) for the new one
-- please. Old closed in 2020 therefore new opened in 2020."
--
-- 037 merged Lightning Rod (-2020) (#1045, wood) into Lightning Rod (#611).
-- #1045 is gone, so the old ride comes back as a new row; #611 keeps its id,
-- riders and rankings and becomes the I-Box ride. Who had what before the
-- merge comes from the rider files at f7b5cb3 (the commit before 037):
--   only #1045: bugmonster1 (Keltan, 2017-07-28, ranked #11) and nolan92708
--     -> their ride rows (3257, 7649) and Keltan's ranking move to Old/Wood;
--   both: aidenalsodoescoasters, aidendoescoasters, bladeefan, kuiperskorner
--     -> 037 deleted their duplicate undated row, so each gets one undated
--        Old/Wood ride back. Their #611 rows (and aidenalso's #28) stay on
--        New/I-Box, where they were.
-- Everyone else on #611 (cmor3, colegarff, maxg, seanpcoakley, unclepat,
-- vacoasterfanatic) logged only the current row and stays on New/I-Box.
--
-- Old/Wood: RMC topper-track wood, 165 ft, 73 mph, 3,800 ft (the stats the
-- row has carried), 13 Jun 2016 - 2020. New/I-Box: steel, RMC Hybrid (the
-- model name the site uses for I-Box track), opened 2020 per Carter. 037's
-- alias 'Lightning Rod (-2020)' moves to the old row; 'Lightning Rod' becomes
-- an alias of the new one so imports of the bare name land on the current ride.
-- Activity: coaster_added for the old row, coaster_renamed for #611.
-- Every statement is guarded, so a second run is a no-op.

INSERT INTO coasters (id, name, park, type, manu, model, h, s, l, inv, dur, laps, yr, opened, openedPrec, closed, closedPrec) SELECT (SELECT COALESCE(MAX(id),0)+1 FROM coasters), 'Lightning Rod (Old/Wood)', 'Dollywood', 'Wood', 'Rocky Mountain Construction', NULL, 165, 73, 3800, 0, NULL, 1, 2016, '2016-06-13', 'day', '2020', 'year' WHERE NOT EXISTS (SELECT 1 FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood');
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Lightning Rod (New/I-Box)', NULL, json_object('id', 611, 'from', 'Lightning Rod', 'park', 'Dollywood') WHERE EXISTS (SELECT 1 FROM coasters WHERE id = 611 AND name = 'Lightning Rod');
UPDATE coasters SET name = 'Lightning Rod (New/I-Box)', type = 'Steel', model = 'RMC Hybrid', yr = 2020, opened = '2020', openedPrec = 'year' WHERE id = 611 AND name = 'Lightning Rod';
UPDATE rides SET coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood') WHERE id IN (3257, 7649) AND coaster_id = 611;
INSERT INTO rides (user_slug, coaster_id, d) SELECT u.s, o.id, NULL FROM (SELECT 'aidenalsodoescoasters' s UNION ALL SELECT 'aidendoescoasters' UNION ALL SELECT 'bladeefan' UNION ALL SELECT 'kuiperskorner') u, coasters o WHERE o.name = 'Lightning Rod (Old/Wood)' AND o.park = 'Dollywood' AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.user_slug = u.s AND r.coaster_id = o.id);
UPDATE rankings SET coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood') WHERE user_slug = 'bugmonster1' AND coaster_id = 611;
UPDATE coaster_aliases SET coaster_id = (SELECT id FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood') WHERE coaster_id = 611 AND former_name = 'Lightning Rod (-2020)';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) VALUES (611, 'Lightning Rod', 'rename', date('now'));
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_added', c.name, NULL, json_object('id', c.id, 'park', c.park) FROM coasters c WHERE c.name = 'Lightning Rod (Old/Wood)' AND c.park = 'Dollywood' AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.kind = 'coaster_added' AND a.subject = c.name AND json_extract(a.detail, '$.park') = 'Dollywood');
