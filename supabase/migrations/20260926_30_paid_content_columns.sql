-- Migration 30 — Lab questions and downloads are paid content
--
-- The problem (demonstrated in tests/integration/paid-content.test.ts,
-- against the live schema; found by the 2026-09-25 external assessment,
-- MEDIA-001; the owner decided on 2026-09-26 that these are paid-only)
-- -----------------------------------------------------------------------
-- Migration 09 hid chapter video ids from browser roles but left
-- chapters.lab_questions and chapters.resource_urls readable, and
-- masterclasses still had a table-level SELECT, so masterclasses.resource_urls
-- was public too. Anyone, signed out included, could read every Essence Lab
-- question and every download link from PostgREST, for unpurchased and
-- unpublished content alike. And the download files themselves sat in the
-- PUBLIC vault-assets bucket, so a link, once read, worked for anyone.
--
-- What this does
-- --------------
-- 1. REVOKE SELECT (lab_questions, resource_urls) ON chapters from anon and
--    authenticated. chapters already uses column-level SELECT (migration 09).
-- 2. masterclasses moves to column-level SELECT the same way: table SELECT
--    revoked from anon and authenticated, every column but resource_urls
--    re-granted. As with chapters, a column added later is invisible to
--    browser roles until it is granted.
-- 3. A PRIVATE bucket, vault-resources, for paid downloads. No SELECT policy:
--    files are served by one-hour signed URLs minted by the service role
--    after the access check (app/lib/paid-content.ts). Admins may upload to
--    it (the admin console mints a signed upload URL through its session, as
--    for vault-assets). vault-assets stays public: it holds thumbnails and
--    marketing images.
--
-- The app reads these columns through the service role after checkAccess()
-- since the commit that ships this file. DEPLOY THAT CODE FIRST: the
-- previously deployed pages select these columns through the member's
-- session and would fail with 42501 once this is applied.
--
-- Safety
-- ------
-- Privileges and one new bucket; no data touched. The existing download in
-- vault-assets is moved by scripts/ops/move_public_resources.mjs afterwards.
-- The DO block refuses if the bucket exists.
--
-- Rollback:
--   GRANT SELECT (lab_questions, resource_urls) ON public.chapters TO anon, authenticated;
--   GRANT SELECT ON public.masterclasses TO anon, authenticated;
--   DELETE FROM storage.buckets WHERE id = 'vault-resources';  -- only if empty
--   DROP POLICY "Admins can upload resources" ON storage.objects;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vault-resources') THEN
        RAISE EXCEPTION 'bucket vault-resources exists; migration 30 has been applied';
    END IF;
    IF NOT has_column_privilege('anon', 'public.chapters', 'lab_questions', 'SELECT')
       OR NOT has_table_privilege('anon', 'public.masterclasses', 'SELECT') THEN
        RAISE EXCEPTION 'live privileges differ from the baseline; inspect before applying';
    END IF;
END $$;

REVOKE SELECT (lab_questions, resource_urls) ON public.chapters FROM anon, authenticated;

REVOKE SELECT ON public.masterclasses FROM anon, authenticated;
GRANT SELECT (
    id, title, subtitle, description, thumbnail_url, order_index, created_at, updated_at,
    stripe_product_id, price_id, title_es, subtitle_es, description_es, takeaways_es,
    video_url, is_published, available_at, price_display, runtime_minutes
) ON public.masterclasses TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vault-resources', 'vault-resources', false, 15728640,
        ARRAY['application/pdf','application/zip','application/x-zip-compressed',
              'image/jpeg','image/png','image/webp']);

CREATE POLICY "Admins can upload resources" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault-resources' AND public.get_user_role((SELECT auth.uid())) = 'admin');

COMMIT;
