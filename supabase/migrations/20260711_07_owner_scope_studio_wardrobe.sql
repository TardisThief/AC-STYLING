-- P1b — Tighten `studio-wardrobe` from authenticated-only to owner-or-admin.
--
-- Folder convention (lib/wardrobe-paths.ts, spec 2026-07-11):
--   <user_id>/…              owned content, checked against auth.uid()
--   wardrobe/<user_id>/…     guest intake for an invite profile
--   wardrobe/<wardrobe_id>/… token intake / unassigned wardrobes,
--                            readable by the wardrobe's eventual owner
--
-- ┌─ COORDINATION ──────────────────────────────────────────────────────────┐
-- │ Deploy the P1b code FIRST (all writes use the convention above), then   │
-- │ apply this. Service-role intake paths bypass RLS and are unaffected.    │
-- │ Verify with scripts/verify_wardrobe_policy.ts afterwards.               │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.can_access_wardrobe_object(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT
    (storage.foldername(object_name))[1] = auth.uid()::text
    OR (
      (storage.foldername(object_name))[1] = 'wardrobe'
      AND (
        (storage.foldername(object_name))[2] = auth.uid()::text
        OR (storage.foldername(object_name))[2] IN (
          SELECT id::text FROM public.wardrobes WHERE owner_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_read" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_insert" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_update" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

DROP POLICY IF EXISTS "studio_wardrobe_authenticated_delete" ON storage.objects;
CREATE POLICY "studio_wardrobe_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-wardrobe' AND public.can_access_wardrobe_object(name));

-- Legacy per-owner policies from the original schema are superseded by the
-- owner-or-admin function above (they only covered the bare `<user_id>/` case).
DROP POLICY IF EXISTS "Owner Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete Access" ON storage.objects;
