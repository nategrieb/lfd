-- ============================================================
-- LFD: Exercise catalogue + set linking
-- Run in Supabase SQL Editor, then run the import script:
--   npx tsx src/scripts/import-exercise-catalogue.ts
-- Source data: https://github.com/yuhonas/free-exercise-db (Unlicense)
-- ============================================================

-- Extend the existing exercises table (used by programs) with catalogue fields.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source_id         TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment         TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS brand             TEXT;      -- e.g. 'Hammer Strength', 'Nautilus' (added by hand after import)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscles   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS force             TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS level             TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS mechanic          TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS kind              TEXT;      -- dataset category: strength, cardio, stretching, ...
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS images            TEXT[] NOT NULL DEFAULT '{}';  -- paths relative to the image CDN base
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_weightlifting  BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS exercises_source_id_key ON exercises (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exercises_name_lower ON exercises (lower(name));

-- Link logged sets to the catalogue. exercise_name stays as the display fallback
-- for free-text exercises that aren't in the catalogue.
ALTER TABLE sets ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sets_user_exercise ON sets (user_id, exercise_id);
