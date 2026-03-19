-- Add post metadata columns to workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS post_photos text[];

-- Create public storage bucket for workout post photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-post-photos', 'workout-post-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read post photos (public bucket)
CREATE POLICY "Post photos are publicly viewable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'workout-post-photos');

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own post photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'workout-post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can delete their own post photos
CREATE POLICY "Users can delete own post photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'workout-post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
