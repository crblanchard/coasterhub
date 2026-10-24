-- 076: Carter's 2026-10-24 rides are 2026-10-23's.
--
-- Carter, 2026-10-24: "Move my Oct 24 2026 rides to Oct 23 please". 15 rides
-- at 12 Pigeon Forge/Gatlinburg parks (rows 7827-7841), logged 2026-10-24
-- 05:46Z — still the evening of the 23rd in US time. Nothing was already on
-- the 23rd, so the day moves whole. The feed row's date moves with it.
-- Matched on user and date, so a second run changes nothing.

UPDATE rides SET d = '2026-10-23' WHERE user_slug = 'crblanchard' AND d = '2026-10-24';
UPDATE activity SET detail = json_set(detail, '$.date', '2026-10-23') WHERE actor = 'crblanchard' AND kind = 'rides' AND json_extract(detail, '$.date') = '2026-10-24';
