-- Allow unauthenticated visitors to read completed workouts via share links (/w/[id])
-- Only completed workouts are public — in-progress workouts stay private.

CREATE POLICY "workouts_select_public"
  ON workouts FOR SELECT TO public
  USING (status = 'completed');

-- Sets are public when their parent workout is completed
CREATE POLICY "sets_select_public"
  ON sets FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = sets.workout_id AND w.status = 'completed'
    )
  );

-- Profiles need to be readable so the share page can show the athlete's display name.
-- profiles_select_authenticated already covers logged-in users; this covers anonymous visitors.
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT TO public
  USING (true);
