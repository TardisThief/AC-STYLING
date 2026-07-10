-- P0/P1 #7 — Lock down the `studio-wardrobe` storage bucket.
--
-- Current policies expose private client wardrobe photos:
--   * "Public Upload Access"  (INSERT -> anon)   → anyone can upload arbitrary files
--   * "Public Read Access"    (SELECT -> public) → every photo is world-readable
--
-- Fix: make the bucket private and require an AUTHENTICATED caller for every
-- operation. This fully closes the leak (no anon read, no anon upload).
--
-- Why authenticated-only rather than strict per-owner (foldername = auth.uid()):
-- the upload folder convention is currently inconsistent — files are stored
-- under the client's user_id in the self-service studio, but under the
-- wardrobe_id (a different UUID) in the stylist dashboard
-- (StudioDashboard → VirtualWardrobe). A per-owner policy would lock clients
-- out of items a stylist uploaded. Normalizing that convention is tracked as a
-- separate cleanup; until then, authenticated-only is the safe posture. Paths
-- are non-enumerable (UUID folder + timestamped filename), so this is a large
-- improvement over world-readable.
--
-- ┌─ COORDINATION ────────────────────────────────────────────────────────────┐
-- │ Applying this makes the bucket PRIVATE → public getPublicUrl() links stop  │
-- │ resolving. The app must render signed URLs (lib/wardrobe-images.ts, wired  │
-- │ into the wardrobe/lookbook components on this branch). Deploy that code    │
-- │ first, verify wardrobe images load, THEN apply this migration.             │
-- └────────────────────────────────────────────────────────────────────────────┘

-- 0. Make the bucket private (no public object URLs).
UPDATE storage.buckets SET public = false WHERE id = 'studio-wardrobe';

-- 1. Drop the permissive anon/public policies.
DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- 2. Authenticated-only access to this bucket (read + write).
DROP POLICY IF EXISTS "studio_wardrobe_authenticated_read" ON storage.objects;
CREATE POLICY "studio_wardrobe_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-wardrobe');

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_insert" ON storage.objects;
CREATE POLICY "studio_wardrobe_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-wardrobe');

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_update" ON storage.objects;
CREATE POLICY "studio_wardrobe_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-wardrobe');

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_delete" ON storage.objects;
CREATE POLICY "studio_wardrobe_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-wardrobe');

-- FUTURE hardening (after normalizing the upload folder convention to always use
-- the client's user_id): tighten SELECT/INSERT to owner-or-admin, e.g.
--   USING (
--     bucket_id = 'studio-wardrobe' AND (
--       (storage.foldername(name))[1] = auth.uid()::text
--       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--     )
--   )
