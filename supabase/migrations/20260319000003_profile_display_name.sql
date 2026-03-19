-- Add display_name to profiles so users can set a real name separate from their username.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- Broaden the people search index to cover display_name as well.
CREATE INDEX IF NOT EXISTS profiles_display_name_lower_idx
  ON public.profiles (lower(display_name));

-- Enforce username format: 3–30 chars, lowercase letters / digits / underscores only.
-- Applied as a CHECK so bad values are rejected at the DB level too.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');

-- Unique username (case-insensitive) — partial index skips NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
