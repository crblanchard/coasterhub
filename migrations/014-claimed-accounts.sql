-- 014 — put the accounts that already exist into the feed
--
-- Signing up records `user_added` ("Sean joined") because the rider row is new.
-- CLAIMING an invite creates no rider — the page has existed for months — so it
-- recorded nothing at all, and somebody taking ownership of their own page went
-- by silently. Sean claimed his on 2026-09-18 and /changes never mentioned it.
--
-- The Worker records `claimed` from now on. This is the catch-up for everybody
-- who got there first, dated from the account itself rather than from today, so
-- the feed reads in the order things actually happened.
--
-- `accounts.created` is SQLite's "YYYY-MM-DD HH:MM:SS"; the feed wants an ISO
-- instant, which is the same string with a T in it and a Z on the end. The
-- backfilled 2026-07 rows use a bare date and the feed already copes with both,
-- but there is no reason to add more of those when the real time is known.
--
-- Guarded on the row not already existing, so running it twice does nothing —
-- and so it stays safe to run again after the next person claims, should
-- anybody ever want to.
INSERT INTO activity (at, actor, kind, subject, n, detail)
SELECT REPLACE(a.created, ' ', 'T') || 'Z', a.slug, 'claimed', COALESCE(u.name, a.slug), NULL, NULL
FROM accounts a
LEFT JOIN users u ON u.slug = a.slug
WHERE NOT EXISTS (
  SELECT 1 FROM activity x WHERE x.kind = 'claimed' AND x.actor = a.slug
);
