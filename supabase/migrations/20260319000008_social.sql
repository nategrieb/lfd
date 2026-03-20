-- ── Jorks (the fist-pound reaction) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_jorks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid        NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, user_id)
);

ALTER TABLE workout_jorks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jorks"
  ON workout_jorks FOR SELECT TO public USING (true);

CREATE POLICY "Users can jork a workout"
  ON workout_jorks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can un-jork a workout"
  ON workout_jorks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workout_jorks_workout_id_idx ON workout_jorks (workout_id);
CREATE INDEX IF NOT EXISTS workout_jorks_user_id_idx    ON workout_jorks (user_id);

-- ── Comments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid        NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON workout_comments FOR SELECT TO public USING (true);

CREATE POLICY "Users can post comments"
  ON workout_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON workout_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS workout_comments_workout_id_idx ON workout_comments (workout_id);

-- ── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- recipient
  actor_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- who acted
  type       text        NOT NULL CHECK (type IN ('jork', 'comment')),
  workout_id uuid        REFERENCES workouts(id) ON DELETE CASCADE,
  comment_id uuid        REFERENCES workout_comments(id) ON DELETE CASCADE,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);
