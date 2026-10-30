-- 084: Report a rider, and block a rider (2026-10-30).
--
-- Both app stores require it of any app where people make profiles: a way to
-- report one, and a way to block someone so you stop seeing them (Apple 1.2,
-- Google's user-generated-content policy). Until this runs, both endpoints
-- answer 503 naming this file, and nothing else on the site changes.
--
-- reports: one row per report. reporter is the rider who sent it (null if that
-- rider later deleted their account); target is the rider it is about. status
-- is for Carter: 'open' until he has looked at it. Each report is also emailed
-- to every admin account when Resend is configured.
--
-- blocks: blocker no longer sees blocked in feeds, lists or follows, and the
-- two cannot follow each other. Blocking removes any follow between them.
--
-- Safe to run twice.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  reporter TEXT,
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS reports_target ON reports (target);
CREATE TABLE IF NOT EXISTS blocks (
  blocker TEXT NOT NULL,
  blocked TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (blocker, blocked)
);
CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks (blocked);
