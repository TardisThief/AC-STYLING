-- P1b — Unbreak the lookbook feature.
--
-- DigitalLookbook.tsx reads/writes `lookbook_items` (canvas layout) and
-- `thumbnail_url`, but the live `lookbooks` table has neither column, so
-- every lookbook save fails today. Also heals the one known row where
-- user_id is NULL by copying the owning wardrobe's owner_id (the component
-- used to insert whatever "clientId" it was handed).
--
-- Apply BEFORE deploying the DigitalLookbook changes if possible; the old
-- code fails either way, the new code needs these columns.

ALTER TABLE public.lookbooks
  ADD COLUMN IF NOT EXISTS lookbook_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Heal user_id from the owning wardrobe where missing or dangling.
UPDATE public.lookbooks l
SET user_id = w.owner_id
FROM public.wardrobes w
WHERE l.wardrobe_id = w.id
  AND w.owner_id IS NOT NULL
  AND (l.user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.user_id));
