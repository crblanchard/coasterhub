-- The 20 announced rides called "Unknown" with no year (Magic Kingdom, Epic
-- Universe, Europa Park, Parc Asterix, the Legolands ...) were counting as
-- operating credits. Carter, 2026-11-25: "call those all opening soon unless
-- the entire park is defunct" (none is: four parks have only that coaster, and
-- read as new parks). openedPrec 'soon' with no date marks "announced, year
-- not known": app.js openingDay() treats it as under construction, and pages
-- say "Opening soon". Setting a real opening date later replaces it.
UPDATE coasters SET openedPrec = 'soon' WHERE name LIKE 'Unknown%' AND yr IS NULL AND opened IS NULL AND closed IS NULL AND (openedPrec IS NULL OR openedPrec <> 'soon');
