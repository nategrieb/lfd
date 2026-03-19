-- ============================================================
-- LFD: Program Builder & Engine
-- Run in Supabase SQL Editor before using /programs features.
-- ============================================================

-- 1. Exercise catalogue (normalised)
CREATE TABLE IF NOT EXISTS exercises (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name     TEXT    NOT NULL UNIQUE,
  slug     TEXT    NOT NULL UNIQUE,
  -- category drives 1RM resolution: 'squat' | 'bench' | 'deadlift' | 'hinge' | 'press' | 'row' | 'accessory'
  category TEXT    NOT NULL DEFAULT 'accessory'
);

-- 2. Program templates (the catalogue of available programs)
CREATE TABLE IF NOT EXISTS program_templates (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT    NOT NULL UNIQUE,
  description    TEXT,
  duration_weeks INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Training days within a template (week_number × day_number)
CREATE TABLE IF NOT EXISTS template_workouts (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID    NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,  -- 1-based
  day_number  INTEGER NOT NULL,  -- 1-based within week
  name        TEXT    NOT NULL,
  UNIQUE (template_id, week_number, day_number)
);

-- 4. Set prescriptions within each training day
--    Each row represents one "set group" (N sets × M reps at X% or Y RPE).
CREATE TABLE IF NOT EXISTS template_sets (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_workout_id UUID         NOT NULL REFERENCES template_workouts(id) ON DELETE CASCADE,
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  exercise_id         UUID         REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name       TEXT         NOT NULL,  -- denormalised fallback for display
  sets_count          INTEGER      NOT NULL,
  reps                INTEGER,     -- NULL for time/AMRAP
  reps_note           TEXT,        -- e.g. '30s', 'AMRAP'
  -- exactly one of percentage / target_rpe should be set
  percentage          NUMERIC(5,4),  -- 0.0–1.0 e.g. 0.8000; NULL if RPE-based
  target_rpe          NUMERIC(3,1),  -- e.g. 8.0; NULL if percentage-based
  tempo               TEXT,          -- e.g. '1.0.1'
  rest_seconds        INTEGER
);

-- 5. User enrollments in a template
CREATE TABLE IF NOT EXISTS program_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  -- 1RMs captured at enrollment time (used to seed scheduled_sets)
  squat_max    INTEGER NOT NULL,
  bench_max    INTEGER NOT NULL,
  deadlift_max INTEGER NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE,  -- start_date + duration_weeks * 7
  status       TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'cancelled'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, start_date)
);

-- 6. Scheduled workout instances generated on enrollment
CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id       UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  template_workout_id UUID NOT NULL REFERENCES template_workouts(id),
  scheduled_date      DATE NOT NULL,
  workout_id          UUID REFERENCES workouts(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'planned',  -- 'planned'|'started'|'completed'|'skipped'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Pre-calculated set targets per scheduled workout
--    Weights are computed from (template_sets.percentage × enrollment maxes) at enrollment time
--    and can be updated via recalculateFutureWorkouts when the user changes their 1RM.
CREATE TABLE IF NOT EXISTS scheduled_sets (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_workout_id UUID         NOT NULL REFERENCES scheduled_workouts(id) ON DELETE CASCADE,
  template_set_id      UUID         REFERENCES template_sets(id) ON DELETE SET NULL,
  sort_order           INTEGER      NOT NULL DEFAULT 0,
  exercise_name        TEXT         NOT NULL,
  sets_count           INTEGER      NOT NULL,
  reps                 INTEGER,
  reps_note            TEXT,
  -- calculated_weight is pre-filled for percentage sets; NULL for RPE sets (user fills in live)
  calculated_weight    INTEGER,
  percentage           NUMERIC(5,4),  -- original percentage (kept for recalculation)
  target_rpe           NUMERIC(3,1),  -- if RPE-based
  tempo                TEXT,
  rest_seconds         INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS scheduled_workouts_user_date  ON scheduled_workouts (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS scheduled_workouts_enrollment ON scheduled_workouts (enrollment_id);
CREATE INDEX IF NOT EXISTS scheduled_sets_workout        ON scheduled_sets (scheduled_workout_id);

-- Backlink on workouts: lets us find the scheduled_workout from an in-progress workout
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS scheduled_workout_id UUID REFERENCES scheduled_workouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS workouts_scheduled_workout ON workouts (scheduled_workout_id);

-- RLS
ALTER TABLE exercises            ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_workouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_workouts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_sets       ENABLE ROW LEVEL SECURITY;

-- Catalogue tables: public read
CREATE POLICY "exercises_read"         ON exercises          FOR SELECT USING (true);
CREATE POLICY "templates_read"         ON program_templates  FOR SELECT USING (true);
CREATE POLICY "template_workouts_read" ON template_workouts  FOR SELECT USING (true);
CREATE POLICY "template_sets_read"     ON template_sets      FOR SELECT USING (true);

-- User-owned tables
CREATE POLICY "enrollments_own"        ON program_enrollments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "scheduled_workouts_own" ON scheduled_workouts  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "scheduled_sets_own"     ON scheduled_sets      FOR ALL
  USING (
    scheduled_workout_id IN (
      SELECT id FROM scheduled_workouts WHERE user_id = auth.uid()
    )
  );
