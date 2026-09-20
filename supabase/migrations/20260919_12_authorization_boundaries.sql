-- Assessment F01-F04. Apply AFTER the coordinated application release:
-- toggleStudioAccess/updateProfileStatus and purchase restoration must use a
-- service-role client after authorization; TailorCard must call the action.
-- No customer rows or stored objects are deleted by this migration.
-- Review/apply against the shared production DB per migrations/README.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- RLS selects rows, not columns. Remove table AND existing column write grants
-- before allowlisting ordinary profile edits. New columns stay non-writable.
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE field record;
BEGIN
  FOR field IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.profiles FROM PUBLIC, anon, authenticated', field.attname, field.attname);
  END LOOP;
END;
$$;
GRANT UPDATE (full_name, username, website, avatar_url, language_preference,
              style_essentials, updated_at) ON public.profiles TO authenticated;
-- Signup's SECURITY DEFINER trigger and verified server actions retain writes.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Legacy clone RPCs are not called by the application. Rate limiting is a
-- server-only operation: browsers must not choose another user's counter/window.
REVOKE EXECUTE ON FUNCTION public.clone_lookbook(uuid, uuid),
  public.clone_wardrobe_item(uuid, uuid),
  public.check_rate_limit(text, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clone_lookbook(uuid, uuid),
  public.clone_wardrobe_item(uuid, uuid),
  public.check_rate_limit(text, integer, interval) TO service_role;
ALTER FUNCTION public.clone_wardrobe_item(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.check_rate_limit(text, integer, interval) SET search_path = '';

DROP POLICY IF EXISTS "boutique_collections: admin write" ON public.boutique_collections;
CREATE POLICY "boutique_collections: admin write" ON public.boutique_collections
  FOR ALL TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');
DROP POLICY IF EXISTS "boutique_collection_items: admin write" ON public.boutique_collection_items;
CREATE POLICY "boutique_collection_items: admin write" ON public.boutique_collection_items
  FOR ALL TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (public.get_user_role((SELECT auth.uid())) = 'admin');
DROP POLICY IF EXISTS "boutique_clicks: admin read" ON public.boutique_clicks;
CREATE POLICY "boutique_clicks: admin read" ON public.boutique_clicks
  FOR SELECT TO authenticated
  USING (public.get_user_role((SELECT auth.uid())) = 'admin');
DROP POLICY IF EXISTS "boutique_clicks: authenticated insert" ON public.boutique_clicks;
CREATE POLICY "boutique_clicks: authenticated insert" ON public.boutique_clicks
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "boutique_clicks: anon insert" ON public.boutique_clicks;
CREATE POLICY "boutique_clicks: anon insert" ON public.boutique_clicks
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

-- Public read access is unchanged. New avatar uploads require an owner folder;
-- there is no avatar-upload caller in the current application to migrate.
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can upload" ON storage.objects;
CREATE POLICY "Avatar owners can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "Admins can upload assets" ON storage.objects;
CREATE POLICY "Admins can upload assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault-assets' AND public.get_user_role((SELECT auth.uid())) = 'admin');

-- Existing objects are not rewritten. 15 MB matches the shipped Vault uploader.
UPDATE storage.buckets SET file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
  WHERE id IN ('avatars','boutique','studio-wardrobe');
UPDATE storage.buckets SET file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','application/pdf','application/zip','application/x-zip-compressed']
  WHERE id = 'vault-assets';

COMMIT;
