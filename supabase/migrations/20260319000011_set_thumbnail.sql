-- Add thumbnail_url column to sets so we can store a mid-frame JPEG
-- captured from the processed (LFD-branded) video at upload time.
-- Used to attach a photo to the Strava activity on sync.
ALTER TABLE sets ADD COLUMN IF NOT EXISTS thumbnail_url text;
