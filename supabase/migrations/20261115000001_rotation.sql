-- ============================================================
-- LFD: your rotation = the workout types you cycle through (Push / Pull / Legs, or any mix)
-- Run in Supabase SQL Editor.
-- ============================================================

SET search_path TO lfd;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rotation text[] NOT NULL DEFAULT '{}';

-- Anyone already logging Push / Pull / Legs gets that rotation to start with (change it any time on Programs).
UPDATE profiles SET rotation = '{Push,Pull,Legs}'
WHERE rotation = '{}'
  AND id IN (
    SELECT user_id FROM workouts
    WHERE status = 'completed' AND workout_types && '{Push,Pull,Legs}'
    GROUP BY user_id HAVING count(*) >= 3
  );

NOTIFY pgrst, 'reload schema';
