CREATE TABLE vendo_internal.media_assets(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES public.profiles(id),vendor_id uuid REFERENCES public.vendors(id),purpose text NOT NULL CHECK(purpose IN('logo','image','document')),mime text NOT NULL,bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 2097152),object_path text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),CHECK(purpose<>'document' OR vendor_id IS NULL));
ALTER TABLE vendo_internal.media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.media_assets FROM PUBLIC,anon,authenticated;
GRANT ALL ON vendo_internal.media_assets TO service_role;
ALTER TABLE vendo_internal.rider_documents ALTER COLUMN encrypted DROP NOT NULL;
ALTER TABLE vendo_internal.rider_documents ADD COLUMN storage_path text;
ALTER TABLE vendo_internal.rider_documents ADD CONSTRAINT document_source CHECK((encrypted IS NULL)<>(storage_path IS NULL));
ALTER TABLE vendo_internal.rider_documents DROP CONSTRAINT rider_documents_mime_check;
ALTER TABLE vendo_internal.rider_documents ADD CONSTRAINT rider_documents_mime_check CHECK(mime IN('image/jpeg','image/png','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
-- Supabase-managed storage may be absent in isolated PostgreSQL tests.
-- Restrictive policies prevent unrelated permissive policies from opening these buckets.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE $policy$CREATE POLICY vendo_server_only_objects ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id NOT IN('vendo-public','vendo-documents')) WITH CHECK(bucket_id NOT IN('vendo-public','vendo-documents'))$policy$;
 END IF;
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  EXECUTE $policy$CREATE POLICY vendo_server_only_buckets ON storage.buckets AS RESTRICTIVE FOR ALL TO anon,authenticated USING(id NOT IN('vendo-public','vendo-documents')) WITH CHECK(id NOT IN('vendo-public','vendo-documents'))$policy$;
 END IF;
END; $$;
