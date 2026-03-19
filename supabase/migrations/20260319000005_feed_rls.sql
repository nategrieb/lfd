-- Allow users to read workouts belonging to people they follow.
-- The existing "own" policy already covers auth.uid() = user_id;
-- this policy covers the social feed case.

CREATE POLICY "workouts_select_following"
  ON public.workouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id  = auth.uid()
        AND following_id = workouts.user_id
    )
  );

-- sets are fetched via a nested join on workouts; their RLS must also
-- allow reading sets that belong to a followed user's workout.
CREATE POLICY "sets_select_following"
  ON public.sets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workouts w
      JOIN public.follows f ON f.following_id = w.user_id
      WHERE w.id          = sets.workout_id
        AND f.follower_id = auth.uid()
    )
  );
