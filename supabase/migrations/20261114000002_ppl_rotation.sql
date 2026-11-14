-- ============================================================
-- LFD: Push / Pull / Legs rotation
-- Run in Supabase SQL Editor.
--  - profiles.ppl_skip_to / ppl_skip_at: where "Skip" moved your rotation to, and when
--  - workouts.template_from: the earlier workout a rotation draft was copied from
-- ============================================================

SET search_path TO lfd;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ppl_skip_to text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ppl_skip_at timestamptz;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS template_from uuid REFERENCES workouts(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
