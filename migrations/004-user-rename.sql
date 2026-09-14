-- SUPERSEDED by 005-drop-user-aliases.sql (2026-09-14), same day. Kept because
-- it was applied to production; the table it creates is dropped again there.
-- Carter's call after seeing it work: a rename should MOVE the username, not
-- leave a forwarding address. See renameRider() in worker.js.
--
-- Renaming a rider. See renameRider() in worker.js.
--
-- Two things were welded together until now: `users.slug` is the URL
-- (/user/carter/stats) and `users.name` is what gets printed. Sign-up derived
-- one from the other, so neither could move. They are separate columns and now
-- they are separately editable — a display name is free text, a username is
-- still [a-z0-9-] because it has to survive being in a path.
--
-- The slug is referenced by rides, rankings, accounts, activity and invites, and
-- none of those are declared foreign keys, so a rename is an explicit batch of
-- UPDATEs. It is also, unavoidably, a change to a public URL — hence this table:
-- the same trick coaster_aliases and park_aliases already play, so a link
-- someone sent last year still lands on the right person.
CREATE TABLE IF NOT EXISTS user_aliases (
  former_slug TEXT PRIMARY KEY,   -- the old URL
  slug        TEXT NOT NULL,      -- who it points at now
  added       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS user_aliases_slug ON user_aliases(slug);
