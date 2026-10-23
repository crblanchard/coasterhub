-- 073: remove Sean's Dollywood visit of 2026-10-22.
--
-- Carter, 2026-10-23: "Remove Sean's visit from today". The only visit Sean
-- logged in days: Dollywood, dated 2026-10-22, 23 rides (rows 7761-7783),
-- posted 2026-10-23T01:30Z, which is "today" in US time. It gave him three
-- new credits (Lightning Rod (New/I-Box), Big Bear Mountain, NightFlight
-- Expedition), none of them ranked, so no ranking is orphaned.
-- The feed row for the visit goes too, or /changes would keep announcing it.
-- Matched on user, date and park, so a second run deletes nothing.

DELETE FROM rides WHERE user_slug = 'seanpcoakley' AND d = '2026-10-22' AND coaster_id IN (SELECT id FROM coasters WHERE park = 'Dollywood');
DELETE FROM activity WHERE actor = 'seanpcoakley' AND kind = 'rides' AND subject = 'Dollywood' AND json_extract(detail, '$.date') = '2026-10-22';
