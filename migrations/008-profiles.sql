-- Profiles: a short bio and a picture.
--
-- `users` has carried `name` (what gets printed) and `slug` (the URL) since the
-- beginning. These two are the first fields on it that are purely a person
-- describing themselves rather than something the site derives.
--
-- `bio` is short on purpose — 280 characters, enforced in the Worker. A profile
-- page is a count, a map and some records; the bio is a caption on that, not a
-- second page of prose to scroll past before reaching the numbers.
--
-- `avatar` holds an R2 OBJECT KEY, not a URL and not image bytes. The Worker
-- serves it at /avatars/<key> from the AVATARS binding, so the picture is on
-- coasterhub.org and moving buckets later is a config change rather than a data
-- migration. NULL means the initial-in-a-circle that the site already draws.
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;
