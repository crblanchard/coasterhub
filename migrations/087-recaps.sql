-- 087: One morning recap a day per rider (2026-10-31).
--
-- The recap (worker.js dailyRecap) goes to everyone between 8 and 9 am
-- Pacific — 11 to noon Eastern — at a minute that moves around day to day.
-- Carter first asked for 9-10 am in each rider's own time, then took it back
-- ("so we're not unnecessarily collecting information"): no time zones are
-- stored. The cron runs every 15 minutes, so this remembers which Pacific
-- date each rider's recap last went, and it goes once.
-- Until this runs the recap goes once, at the 8:00 Pacific run.
-- Safe to run twice.
CREATE TABLE IF NOT EXISTS recaps (
  slug TEXT PRIMARY KEY,
  day TEXT
);
