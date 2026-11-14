-- ============================================================
-- LFD: workout types (Push, Pull, Legs, Chest, Back, Shoulders, Arms)
-- Run in Supabase SQL Editor.
-- A workout can have more than one (e.g. Chest + Arms), shown as pills.
-- ============================================================

SET search_path TO lfd;

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS workout_types text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
