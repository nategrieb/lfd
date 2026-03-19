-- ─── Follows ────────────────────────────────────────────────────────────────
-- Directional follow graph: follower_id follows following_id.
-- Mutual follows = friendship in the social sense.

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see the follow graph (needed for follower counts,
-- mutual-follow detection, and scoping the feed query server-side).
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (auth.role() = 'authenticated');

-- You can only add follows on behalf of yourself.
CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- You can only remove your own follows.
CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Index for looking up "who does this user follow?" efficiently.
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);

-- ─── Profiles — broaden read access for friend search ───────────────────────
-- Supabase ORs multiple SELECT policies, so adding this alongside any existing
-- "read own row" policy makes all profiles visible to authenticated users.
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Index for username search (used by ILIKE on /people page).
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));
