-- A baseline for Home's Global top 10 arrows (Carter, 2026-11-27: "Here's the
-- coaster list from a couple weeks ago use this as a baseline for arrows and
-- just say since last week even though it's not true. Then starting Monday
-- we'll have actual"). From his screenshot of the Global list, places 1-10.
-- The arrows compare with the newest rank_snapshots row; this one is dated
-- 2026-11-16 so the first real Monday copy (weeklyRankSnapshot, 2026-11-30)
-- takes over as soon as it is saved. data.positions = {coaster id: place};
-- partial = rides it does not name get no arrow (app.js globalTally).
-- Ids matched by name + park on 2026-11-27:
--   638 VelociCoaster (Islands of Adventure)   530 Eejanaika (Fuji-Q Highland)
--   277 Voyage (Holiday World)                 597 Fury 325 (Carowinds)
--   489 Kondaa (Walibi Belgium)                513 Toutatis (Parc Astérix)
--   387 Steel Vengeance (Cedar Point)          463 Untamed (Walibi Holland)
--   813 ArieForce One (Fun Spot Atlanta)       571 Iron Gwazi (Busch Gardens Tampa Bay)
CREATE TABLE IF NOT EXISTS rank_snapshots (week TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
INSERT OR IGNORE INTO rank_snapshots (week, at, data) VALUES ('2026-11-16', '2026-11-16T10:00:00Z',
  '{"partial":true,"positions":{"638":1,"530":2,"277":3,"597":4,"489":5,"513":6,"387":7,"463":8,"813":9,"571":10}}');
