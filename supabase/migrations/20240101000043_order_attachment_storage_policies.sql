-- Storage policies for order line screenshot attachments (authenticated upload + read).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can update own attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update own attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
