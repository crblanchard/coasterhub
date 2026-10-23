-- 075: clearer Lightning Rod names.
--
-- Carter, 2026-10-23: "Call them lightning rod and Lightning Rod (Wood,
-- 2016-2020) to make it clear. Yes keep them separate."
--   #611  Lightning Rod (New/I-Box) -> Lightning Rod
--   #1823 Lightning Rod (Old/Wood)  -> Lightning Rod (Wood, 2016-2020)
-- Still two independent credits. The comma in the old one's brackets also
-- keeps rankings' racing-pair finder off it (as for "Wacky Worm (yellow
-- track, …)"), on top of the Old/New rule added the same day.
-- The 071 names stay as aliases; 'Lightning Rod' stops being an alias of #611
-- now that it is the name again (the Worker's rename does the same).
-- Activity: coaster_renamed for each. Guarded on the current names, so a
-- second run is a no-op.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Lightning Rod', NULL, json_object('id', id, 'from', name, 'park', park) FROM coasters WHERE id = 611 AND name = 'Lightning Rod (New/I-Box)';
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_renamed', 'Lightning Rod (Wood, 2016-2020)', NULL, json_object('id', id, 'from', name, 'park', park) FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, name, 'rename', date('now') FROM coasters WHERE id = 611 AND name = 'Lightning Rod (New/I-Box)';
INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) SELECT id, name, 'rename', date('now') FROM coasters WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood';
UPDATE coasters SET name = 'Lightning Rod' WHERE id = 611 AND name = 'Lightning Rod (New/I-Box)';
UPDATE coasters SET name = 'Lightning Rod (Wood, 2016-2020)' WHERE name = 'Lightning Rod (Old/Wood)' AND park = 'Dollywood';
DELETE FROM coaster_aliases WHERE coaster_id = 611 AND former_name = 'Lightning Rod';
