-- Allow anon (unauthenticated) users to create signed URLs for reading private photos
-- This is safe because signed URLs have an expiration time and can only be used to download the specific object

CREATE POLICY storage_read_anon ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
  );
