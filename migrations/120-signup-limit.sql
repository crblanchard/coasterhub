-- 120: sign-up rate limit (Carter, 2026-11-02: spam prevention, "yes" to at
-- most 3 new accounts an hour from one address). One row per sign-up: a hash of
-- the address it came from (never the address itself) and when. The Worker
-- counts the last hour's rows before creating an account and prunes rows older
-- than a day as it adds one. Without this table sign-up still works, unlimited,
-- as before. Safe to run twice.
CREATE TABLE IF NOT EXISTS signups (ip TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS signups_ip_at ON signups(ip, at);
