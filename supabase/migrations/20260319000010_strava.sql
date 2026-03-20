-- Add Strava OAuth token columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS strava_athlete_id  bigint,
  ADD COLUMN IF NOT EXISTS strava_access_token  text,
  ADD COLUMN IF NOT EXISTS strava_refresh_token text,
  ADD COLUMN IF NOT EXISTS strava_token_expires_at timestamptz;

-- Users can only read/update their own Strava tokens
-- (profiles RLS already restricts by user id; this just documents intent)
