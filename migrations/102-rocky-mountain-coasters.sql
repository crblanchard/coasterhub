-- 102: the maker's name is Rocky Mountain Coasters now (Carter, 2026-10-31:
-- "rename rocky mountain construction rocky mountain coasters :("). All 29 rows
-- carried "Rocky Mountain Construction". Model names stay "RMC ..." - the
-- initials still fit, and search's initials match still finds "RMC". One
-- coaster_edited row per coaster, as an /edit change would write (hidden from
-- /changes like every stat edit). Safe to run twice.
INSERT INTO activity (at, actor, kind, subject, n, detail) SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL, 'coaster_edited', name, 1, json_object('id', id, 'fields', json_array('manu'), 'via', '102') FROM coasters WHERE manu = 'Rocky Mountain Construction';
UPDATE coasters SET manu = 'Rocky Mountain Coasters' WHERE manu = 'Rocky Mountain Construction';
