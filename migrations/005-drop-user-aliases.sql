-- Renaming a rider is a MOVE, not a forward.
--
-- 004 added user_aliases so a renamed rider's old URL kept resolving, the way
-- coaster_aliases and park_aliases do. Carter's call on seeing it in use: the
-- old username should be gone, not forwarded — "fully remove the old ID and
-- move everything to the new one".
--
-- So the table is dropped and nothing reads it. The trade is deliberate and
-- worth writing down: after a rename, /user/<old>/ returns 404 instead of
-- redirecting, and the freed username can be taken by anyone — inheriting the
-- name and nothing else, since every row was moved by renameRider().
--
-- Coasters and parks still keep their aliases. The difference is that a coaster
-- gets renamed by the world (Wildcat becomes Wildcat's Revenge, and both names
-- refer to the same thing forever), whereas a person choosing a new username is
-- choosing to stop being findable at the old one.
DROP INDEX IF EXISTS user_aliases_slug;
DROP TABLE IF EXISTS user_aliases;
