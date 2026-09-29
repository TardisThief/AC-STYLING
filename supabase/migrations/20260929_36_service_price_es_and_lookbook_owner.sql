-- Migration 36 — a Spanish service price, and a lookbook owned by its wardrobe
--
-- The problems (found doing ARCH-001, 2026-09-28)
-- -----------------------------------------------
-- 1. The Services page read services.price_display_es, a column that never
--    existed, so Spanish visitors always got the English price text.
-- 2. A lookbook recorded two owners: user_id (a profile) and wardrobe_id.
--    Since migration 33 the wardrobe is the owner that outlives the client,
--    and user_id was kept in step by hand in three onboarding flows. It also
--    fed the read policy, so a lookbook could be visible to someone who had
--    no part in its wardrobe any more.
--
-- What this does
-- --------------
-- 1. services.price_display_es (nullable; Spanish falls back to price_display).
--    services has table-level grants, so it is readable like price_display.
-- 2. lookbooks.wardrobe_id becomes NOT NULL; the member read policy is rebuilt
--    on the wardrobe alone (a published lookbook in a wardrobe you own); then
--    lookbooks.user_id and its foreign key are dropped. The admin policy is
--    unchanged.
--
-- Safety
-- ------
-- Production had 0 lookbooks on 2026-09-28. The DO block refuses if user_id
-- is already gone, or if any lookbook has no wardrobe (it would be orphaned:
-- decide about it by hand first).
--
-- Rollback: ALTER TABLE public.lookbooks ADD COLUMN user_id uuid REFERENCES
-- public.profiles(id) ON DELETE SET NULL; ALTER COLUMN wardrobe_id DROP NOT
-- NULL; restore the old policy from the pre-migration baseline;
-- ALTER TABLE public.services DROP COLUMN price_display_es.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'lookbooks' AND column_name = 'user_id') THEN
        RAISE EXCEPTION 'lookbooks.user_id does not exist; migration 36 has been applied';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lookbooks WHERE wardrobe_id IS NULL) THEN
        RAISE EXCEPTION 'lookbooks without a wardrobe exist; resolve them before migration 36';
    END IF;
END $$;

ALTER TABLE public.services ADD COLUMN price_display_es text;
COMMENT ON COLUMN public.services.price_display_es IS
    'The price as shown in Spanish; the Services page falls back to price_display when empty. Migration 36.';

ALTER TABLE public.lookbooks ALTER COLUMN wardrobe_id SET NOT NULL;

DROP POLICY "Users can view their published lookbooks" ON public.lookbooks;
CREATE POLICY "Users can view their published lookbooks" ON public.lookbooks
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND status = 'Published'
        AND wardrobe_id IN (SELECT w.id FROM public.wardrobes w WHERE w.owner_id = auth.uid())
    );

ALTER TABLE public.lookbooks DROP COLUMN user_id;

COMMIT;
