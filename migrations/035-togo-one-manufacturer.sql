-- 035: one manufacturer, "TOGO" (2026-10-17). Carter: "merge Togo and TOGO ...
-- I want them to merge into TOGO". Live D1 had 2 coasters under "TOGO" and 7
-- under "Togo", so the manufacturer showed up twice. Models are left as they
-- are. Safe to run twice: the second run matches nothing.
UPDATE coasters SET manu = 'TOGO' WHERE manu = 'Togo';
