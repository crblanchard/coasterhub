-- 057: Steel Curtain (Kennywood), from RCDB via Carter's screenshot,
-- 2026-10-17. It had no stats, maker or dates. RCDB: S&S Worldwide (custom,
-- no model), 220 ft, 75 mph, 4,000 ft, 8 inversions, 2:00; operating since
-- 13 July 2019. Activity is the Worker's coaster_edited shape; both
-- statements are guarded on the row still having no maker.

INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', c.name, 9, json_object('id', c.id, 'fields', json_array('manu','h','s','l','inv','dur','yr','opened','openedPrec'), 'via', '057')
  FROM coasters c WHERE c.name = 'Steel Curtain' AND c.park = 'Kennywood' AND c.manu IS NULL;
UPDATE coasters SET manu = 'S&S Worldwide', h = 220, s = 75, l = 4000, inv = 8, dur = 120, yr = 2019, opened = '2019-07-13', openedPrec = 'day' WHERE name = 'Steel Curtain' AND park = 'Kennywood' AND manu IS NULL;
