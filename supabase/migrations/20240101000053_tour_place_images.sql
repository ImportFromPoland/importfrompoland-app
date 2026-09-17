-- Place images for tour report (logo left + thumbnail right)

ALTER TABLE tour_places
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN tour_places.logo_url IS 'Small brand logo URL (left of stop in PDF)';
COMMENT ON COLUMN tour_places.thumbnail_url IS 'Showroom/exterior photo URL (right of stop in PDF)';

-- Public bucket so TourReportPDF (react-pdf) can load images by URL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-places',
  'tour-places',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated read tour-places" ON storage.objects;
CREATE POLICY "Authenticated read tour-places"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'tour-places');

DROP POLICY IF EXISTS "Public read tour-places" ON storage.objects;
CREATE POLICY "Public read tour-places"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tour-places');

DROP POLICY IF EXISTS "Admin upload tour-places" ON storage.objects;
CREATE POLICY "Admin upload tour-places"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tour-places'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  );

DROP POLICY IF EXISTS "Admin update tour-places" ON storage.objects;
CREATE POLICY "Admin update tour-places"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tour-places'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  )
  WITH CHECK (
    bucket_id = 'tour-places'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  );

DROP POLICY IF EXISTS "Admin delete tour-places" ON storage.objects;
CREATE POLICY "Admin delete tour-places"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tour-places'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff_admin')
  );
