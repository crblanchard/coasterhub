-- 186: Luna Park (Sydney)'s 1995 Arrow Big Dipper is "Big Dipper (1995)", to
-- match "Big Dipper (1935)" (Carter, 2026-11-18: "call the other one big
-- dipper 1995 for consistency"). It was "Big Dipper (Old)" for an hour (184);
-- that rename's /changes row is relabelled rather than a second one added.
-- Safe to run twice.
UPDATE coasters SET name='Big Dipper (1995)' WHERE id=2034 AND name IN ('Big Dipper (Old)','Big Dipper') AND park='Luna Park (Sydney)';
UPDATE activity SET subject='Big Dipper (1995)' WHERE kind='coaster_renamed' AND subject='Big Dipper (Old)' AND json_extract(detail,'$.park')='Luna Park (Sydney)';
