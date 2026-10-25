-- 077: Carter's Carowinds rides are 2026-10-24's, not the 25th.
--
-- Carter, 2026-10-25: "Please move my carowinds rides from October 25 2026 to
-- October 24 2026". 14 rides, logged 2026-10-25 04:25Z (the evening of the
-- 24th in US time). His Six Flags Over Georgia rides of the 25th stay put.
-- The Carowinds feed row's date moves with them. Matched on user, date and
-- park, so a second run changes nothing.

UPDATE rides SET d = '2026-10-24' WHERE user_slug = 'crblanchard' AND d = '2026-10-25' AND coaster_id IN (SELECT id FROM coasters WHERE park = 'Carowinds');
UPDATE activity SET detail = json_set(detail, '$.date', '2026-10-24') WHERE actor = 'crblanchard' AND kind = 'rides' AND subject = 'Carowinds' AND json_extract(detail, '$.date') = '2026-10-25';
