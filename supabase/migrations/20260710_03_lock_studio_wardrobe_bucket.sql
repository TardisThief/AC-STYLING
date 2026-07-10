-- P0 #7 — Lock down the `studio-wardrobe` storage bucket.
--
-- Current policies expose private client wardrobe photos:
--   * "Public Upload Access"  (INSERT -> anon)   → anyone can upload arbitrary files
--   * "Public Read Access"    (SELECT -> public) → every photo is world-readable
--
-- Fix: require an authenticated caller; scope access to the owner (the file is
-- stored under `<userId>/...`, so the first path segment must match auth.uid())
-- OR an admin. Reads then move to signed URLs.
--
-- ┌─ COORDINATION ────────────────────────────────────────────────────────────┐
-- │ Applying this makes the bucket PRIVATE. Public getPublicUrl() links will   │
-- │ stop resolving. The app must switch to createSignedUrl() for wardrobe      │
-- │ images (tracked as a P1 code change). Apply this migration together with   │
-- │ that code change, or the wardrobe UI will show broken images.              │
-- └────────────────────────────────────────────────────────────────────────────┘

-- 0. Make the bucket private (no public object URLs).
UPDATE storage.buckets SET public = false WHERE id = 'studio-wardrobe';

-- 1. Drop the permissive policies.
DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- Helper predicate: caller owns the object (path is `<uid>/...`) or is admin.
--   storage.foldername(name)[1] is the first path segment.

-- 2. Owner/admin READ.
DROP POLICY IF EXISTS "studio_wardrobe_read_own_or_admin" ON storage.objects;
CREATE POLICY "studio_wardrobe_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'studio-wardrobe'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

-- 3. Owner/admin INSERT.
DROP POLICY IF EXISTS "studio_wardrobe_insert_own_or_admin" ON storage.objects;
CREATE POLICY "studio_wardrobe_insert_own_or_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'studio-wardrobe'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

-- 4. Owner/admin UPDATE + DELETE.
DROP POLICY IF EXISTS "studio_wardrobe_modify_own_or_admin" ON storage.objects;
CREATE POLICY "studio_wardrobe_modify_own_or_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'studio-wardrobe'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "studio_wardrobe_delete_own_or_admin" ON storage.objects;
CREATE POLICY "studio_wardrobe_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'studio-wardrobe'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );
