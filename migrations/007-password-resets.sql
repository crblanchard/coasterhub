-- Password resets. See the /api/auth/forgot and /api/auth/reset routes.
--
-- Until now a forgotten password meant Carter editing D1 by hand, because the
-- Worker had no way to send mail. It does now (Resend), so this is the table
-- behind it.
--
-- Same shape as `sessions`, for the same reason: `token` holds the SHA-256 of
-- the value that goes in the link, never the value itself. A dump of this table
-- cannot be turned into a working reset link.
--
-- `used` is what makes a link single-use. Rows are kept after use rather than
-- deleted, so a second click gets "this link has already been used" instead of
-- the same answer as a forged token — the difference matters to someone who
-- clicked twice and is wondering whether they have been hacked.
CREATE TABLE IF NOT EXISTS resets (
  token   TEXT PRIMARY KEY,
  account INTEGER NOT NULL,
  created TEXT NOT NULL,
  expires TEXT NOT NULL,
  used    TEXT
);
CREATE INDEX IF NOT EXISTS resets_account ON resets(account);
