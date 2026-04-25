-- Ensure API roles can access natestagram schema objects (RLS still applies)
GRANT USAGE ON SCHEMA natestagram TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA natestagram TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA natestagram TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA natestagram
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA natestagram
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- Natestagram media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Photos are publicly viewable'
  ) THEN
    CREATE POLICY "Photos are publicly viewable"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can update photos'
  ) THEN
    CREATE POLICY "Authenticated users can update photos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'photos');
  END IF;
END
$$;
