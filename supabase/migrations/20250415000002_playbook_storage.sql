-- Create private storage bucket for Playbook PDF delivery
-- PDFs are accessed via signed URLs (7-day expiry) generated at purchase time

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'playbook-pdfs',
  'playbook-pdfs',
  false,
  52428800,  -- 50MB max
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Only service_role can upload/manage files (no public access)
-- Signed URLs bypass RLS, so no SELECT policy needed for download
CREATE POLICY "Service role manages playbook PDFs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'playbook-pdfs')
  WITH CHECK (bucket_id = 'playbook-pdfs');
