-- Migration 35 — a lookbook is stored one way: its canvas of references
--
-- The problem (ARCH-001, 2026-09-25 external assessment)
-- -------------------------------------------------------
-- A lookbook's garments were modelled twice:
--   - lookbooks.lookbook_items (jsonb), the canvas the app reads and writes,
--     whose entries were full SNAPSHOTS of the garment row (image_url and
--     all), so a garment re-photographed, moved or deleted stayed stale on
--     every canvas, and relocating a wardrobe's photos had to rewrite image
--     paths inside the JSON (migration 33's work);
--   - public.lookbook_items (lookbook_id, item_id, position), a join table no
--     application code reads or writes, used only by clone_lookbook(), which
--     copies the join rows and not the canvas, so its "copy" came out empty.
-- clone_lookbook and clone_wardrobe_item are SECURITY DEFINER and called by
-- nothing; service-role-only since migration 12.
--
-- What this does
-- --------------
-- 1. Every canvas entry becomes a reference: {id, x, y, width}, `id` being
--    the wardrobe item's. The app now reads the garment (and its photo) live
--    (components/studio/DigitalLookbook.tsx, app/lib/lookbook-canvas.ts).
-- 2. Drops clone_lookbook, clone_wardrobe_item and the lookbook_items table.
--
-- Safety
-- ------
-- Production had 0 lookbooks and 0 lookbook_items rows on 2026-09-28, so
-- step 1 changes no row there; it makes the rule hold for any database.
-- The DO block refuses if the table is already gone.
--
-- Rollback: recreate the table and functions from the pre-migration baseline
-- (git show HEAD~:supabase/migrations/00000000000000_baseline.sql). Canvas
-- entries stay references; the app no longer needs the snapshot fields.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF to_regclass('public.lookbook_items') IS NULL THEN
        RAISE EXCEPTION 'public.lookbook_items does not exist; migration 35 has been applied';
    END IF;
END $$;

UPDATE public.lookbooks AS l
SET lookbook_items = COALESCE((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'id', e->'id', 'x', e->'x', 'y', e->'y', 'width', e->'width')) ORDER BY n)
        FROM jsonb_array_elements(l.lookbook_items) WITH ORDINALITY AS t(e, n)
        WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(e->'id') = 'string'
    ), '[]'::jsonb)
WHERE jsonb_typeof(l.lookbook_items) = 'array' AND l.lookbook_items <> '[]'::jsonb;

DROP FUNCTION public.clone_lookbook(uuid, uuid);
DROP FUNCTION public.clone_wardrobe_item(uuid, uuid);
DROP TABLE public.lookbook_items;

COMMENT ON COLUMN public.lookbooks.lookbook_items IS
    'The canvas: [{id, x, y, width}], each id a wardrobe_items.id. References only; the garment and its photo are read live. See migration 35.';

COMMIT;
