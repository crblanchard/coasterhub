-- 010 — following
--
-- One row per "A follows B", both sides a user slug. No id column: the pair IS
-- the identity, and a primary key on it is what makes following twice a no-op
-- rather than a second row to clean up later.
--
-- Slugs, not account ids, because everything else on the site is keyed by slug
-- and a rename already rewrites them everywhere (see 004-user-rename.sql). An
-- account id would survive a rename without help, but it would also be the only
-- table here that could not be read by eye in the D1 console.
--
-- Nothing is enforced in SQL about WHO can be followed. The Worker refuses a
-- followee with no account — you cannot follow a rider who has not claimed
-- their page yet — because that is a rule about the product, not the data, and
-- it will relax the day those riders claim. Same for following yourself.
--
-- Re-running this is a no-op.
CREATE TABLE IF NOT EXISTS follows (
  follower TEXT NOT NULL,
  followee TEXT NOT NULL,
  at       TEXT NOT NULL,
  PRIMARY KEY (follower, followee)
);

-- Followers of X is the query the profile page makes on every visit; the
-- primary key only covers the other direction.
CREATE INDEX IF NOT EXISTS follows_followee ON follows(followee);
