-- Ensure API roles can access lfd schema objects (RLS still applies)
GRANT USAGE ON SCHEMA lfd TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lfd TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lfd TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA lfd
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lfd
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- Add missing public bucket used by workout upload flow
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-videos', 'workout-videos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Workout videos are publicly viewable'
  ) THEN
    CREATE POLICY "Workout videos are publicly viewable"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'workout-videos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own workout videos'
  ) THEN
    CREATE POLICY "Users can upload own workout videos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'workout-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own workout videos'
  ) THEN
    CREATE POLICY "Users can delete own workout videos"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'workout-videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END
$$;
