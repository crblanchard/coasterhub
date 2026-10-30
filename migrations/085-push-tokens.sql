-- 085: Phones that get notifications (2026-10-30).
--
-- The iPhone/Android app registers its Firebase Cloud Messaging token here
-- after the rider allows notifications (POST /api/push/token). One row per
-- phone; token is the key, so a phone that changes hands moves to whoever
-- registered it last. A token Firebase reports dead is deleted on the next
-- send, and deleting an account deletes its rows.
--
-- Until this runs, registering answers 503 naming this file and nothing is
-- ever sent. Safe to run twice.
CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  platform TEXT,
  created TEXT NOT NULL,
  seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_tokens_slug ON push_tokens (slug);
