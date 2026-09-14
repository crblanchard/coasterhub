-- Accounts: a rider signs in as themselves instead of everyone sharing one
-- password. See the auth section of worker.js.
--
-- What this replaces: ADMIN_PASSWORD gated every write, so whoever held it could
-- log rides into anyone's count by changing a dropdown. An account is bound to
-- exactly one rider (accounts.slug), and the ride/ranking routes now check that
-- binding. ADMIN_PASSWORD still exists and still opens everything — it is the
-- break-glass key and what /add, /edit and /import keep using.
--
-- Nothing here is destructive: the five riders that predate accounts keep working
-- through the shared password until each one claims their row with an invite.

-- One login. `slug` is the rider this account owns — NULL only in the window
-- between a row being created and its rider being attached, which no code path
-- currently leaves open (signup makes the rider, claim attaches an existing one).
CREATE TABLE IF NOT EXISTS accounts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT NOT NULL,      -- stored lowercased + trimmed; UNIQUE below
  pw       TEXT NOT NULL,      -- pbkdf2$sha256$<iters>$<salt b64>$<hash b64>
  slug     TEXT,               -- users.slug this account may write to
  is_admin INTEGER NOT NULL DEFAULT 0,
  created  TEXT NOT NULL,
  seen     TEXT                -- last successful sign-in, for spotting dead accounts
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(lower(email));
-- One account per rider: two logins writing to one count would put us straight
-- back to "whose ride is this?".
CREATE UNIQUE INDEX IF NOT EXISTS accounts_slug ON accounts(slug) WHERE slug IS NOT NULL;

-- Live sign-ins. `token` is the SHA-256 of the cookie value, never the value
-- itself: a dump of this table cannot be replayed as a login.
CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  account INTEGER NOT NULL,
  created TEXT NOT NULL,
  expires TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account);

-- One-time links that attach a login to a rider who already has rides. The five
-- original riders are the reason this exists; after that, signup creates the
-- rider and the invite path is only for handing an existing count to its owner.
CREATE TABLE IF NOT EXISTS invites (
  code    TEXT PRIMARY KEY,   -- random; the URL is the credential
  slug    TEXT NOT NULL,      -- the rider being claimed
  created TEXT NOT NULL,
  used    TEXT                -- when it was redeemed; non-NULL = spent
);
