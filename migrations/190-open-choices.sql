-- Carter's picks where the sources disagree (2026-11-18: "if there's
-- mismatching numbers let me know and i can choose"). One row per coaster
-- and field: which source he chose ('site' for the current value, or
-- wikidata / coasterpedia / osm) and the value it had at the time, so a
-- later refresh that changes the source's value shows up as a new mismatch
-- rather than silently changing his pick. Part of the parallel dataset only;
-- `coasters` is not touched. Written by POST /api/open-choice (admins).
CREATE TABLE IF NOT EXISTS open_choices (coaster_id INTEGER NOT NULL, field TEXT NOT NULL, source TEXT NOT NULL, value TEXT, chosen_by TEXT, at TEXT, PRIMARY KEY (coaster_id, field));
