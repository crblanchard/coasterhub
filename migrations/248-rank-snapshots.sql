-- Weekly copies of every ranking list (Carter, 2026-11-26: "start saving weekly
-- scores ... every monday morning", 2am Pacific). worker.js weeklyRankSnapshot
-- makes this table itself and fills one row a week from the 15-minute cron;
-- written down here so the table is on record. data = {rankings: [{slug,
-- order}], credits: {slug: n}}, enough to recompute that week's Global scores.
CREATE TABLE IF NOT EXISTS rank_snapshots (week TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
