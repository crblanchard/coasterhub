-- Recent changes feed. See recordActivity() in worker.js.
--
-- `actor` is whoever the request already identified: the rider picked on /log,
-- the slug in a /rankings URL. It is NULL for every database-editing route,
-- because those carry no rider at all — there is one shared admin password and
-- no accounts, so a name there would be a guess. The page renders those
-- impersonally ("X was added") rather than attributing them to someone.
CREATE TABLE IF NOT EXISTS activity (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      TEXT NOT NULL,      -- ISO timestamp
  actor   TEXT,               -- users.slug, or NULL when the request carries no rider
  kind    TEXT NOT NULL,      -- rides | credits | ranking | ride_removed | coaster_*
  subject TEXT,               -- coaster or park name, for the sentence
  n       INTEGER,            -- headline count ("ranked 20 new coasters")
  detail  TEXT                -- JSON: the numbers behind the sentence
);
CREATE INDEX IF NOT EXISTS activity_at ON activity(at DESC, id DESC);

-- Day-one backfill. Nothing before this table existed was ever timestamped, so
-- the only recoverable history is the alias table's `added` dates: every rename
-- and merge, at midday, with no actor. The page labels these as reconstructed.
INSERT INTO activity (at, actor, kind, subject, n, detail)
SELECT COALESCE(a.added, '2026-07-30') || 'T12:00:00.000Z', NULL,
       CASE WHEN a.note LIKE 'merge%' THEN 'coaster_merged' ELSE 'coaster_renamed' END,
       c.name, NULL,
       json_object('id', a.coaster_id, 'from', a.former_name, 'backfilled', 1)
FROM coaster_aliases a
JOIN coasters c ON c.id = a.coaster_id
WHERE a.added IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM activity x
                  WHERE x.subject = c.name AND x.detail LIKE '%' || a.former_name || '%');
