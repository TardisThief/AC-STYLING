-- Migration 17 — repair the catalogue so it round-trips
--
-- Phase 3.6 item 1, and the gate on content work.
--
-- The problem
-- -----------
-- Exporting the live catalogue with `scripts/export_catalog.mjs` and feeding
-- it straight back to `scripts/import_catalog.mjs` reports 24 errors. The tool
-- the content work depends on refuses to accept the content it just exported.
-- Both causes are in the data.
--
-- 1. **Blank Essence Lab prompts.** 8 questions across 7 chapters carry the
--    legacy `question` key with no `label`. The Lab renders `label`, so those
--    prompts render **empty**. Every affected chapter is currently
--    `is_published = false`, which is the only reason no customer has met a
--    blank question — it fires on publish, which is exactly what the content
--    work is about to do.
--
-- 2. **Contradictory module flags.** 6 chapters have `masterclass_id` set and
--    `is_standalone = true`. A module inside a masterclass is by definition not
--    standalone, and the importer rejects the combination.
--
-- What this deliberately does NOT touch
-- ------------------------------------
-- `unit-1-2-universal-styles` has *both* a working `label` ("What is your
-- Style?") and a different `question` ("Select your top 1-2 Universal
-- Styles."). It renders correctly today. Renaming `question` to `label` there
-- would silently overwrite one piece of editorial copy with another, which is
-- an editorial decision and not one a migration should make. It is left
-- exactly as it is; if the `question` text is the better prompt, that is a
-- content edit.
--
-- The rename also cannot invent `label_es`. The legacy rows have no Spanish
-- prompt, so those questions will render English in both locales until the
-- Spanish copy is written — a content task, flagged rather than faked.
--
-- Safety
-- ------
-- Touches 7 chapters' `lab_questions` and 6 chapters' `is_standalone`, all of
-- them unpublished. The JSON rewrite preserves element order and every other
-- key; it only moves `question` to `label` where `label` is absent.
--
-- Rollback: there is no automatic one — the pre-state is recorded in
-- `content/catalog/catalog.json` as committed in 4b6c2bc, which is an export
-- taken before this ran.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

-- 1. Legacy `question` -> `label`, only where `label` is missing.
UPDATE public.chapters ch
SET lab_questions = (
        SELECT jsonb_agg(
                   CASE
                       WHEN e ? 'question' AND NOT (e ? 'label')
                           THEN (e - 'question') || jsonb_build_object('label', e -> 'question')
                       ELSE e
                   END
                   ORDER BY ord
               )
        FROM jsonb_array_elements(ch.lab_questions) WITH ORDINALITY AS t(e, ord)
    ),
    updated_at = now()
WHERE ch.lab_questions IS NOT NULL
  AND jsonb_typeof(ch.lab_questions) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(ch.lab_questions) AS e2
      WHERE e2 ? 'question' AND NOT (e2 ? 'label')
  );

-- 2. A module inside a masterclass is not standalone.
UPDATE public.chapters
SET is_standalone = false,
    updated_at = now()
WHERE masterclass_id IS NOT NULL
  AND is_standalone = true;

COMMIT;
