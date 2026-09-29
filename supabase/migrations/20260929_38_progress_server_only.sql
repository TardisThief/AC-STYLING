-- Migration 38 — course progress is written by the server only; the single
-- term line-item columns go
--
-- APPLY ONLY AFTER the code that no longer writes user_progress from the
-- browser, and no longer reads or writes profiles.access_term_line_item /
-- user_access_grants.term_line_item, is live in production. The code before
-- it inserts progress with the member's own session and would break.
--
-- 1. Course progress (user_progress)
-- ----------------------------------
-- Two member INSERT policies ("Users can insert own progress", and "Users can
-- update own progress." which is also FOR INSERT) let a member insert any
-- content_id for herself. So she could mark any chapter mastered without
-- answering it, and, since her Essence journal loads the paid Lab questions of
-- every chapter in her `lab_unlocked:` rows (getAllEssenceData), read the
-- questions of chapters she never bought. Progress is now written only by
-- completeChapter and markLabUnlocked (app/actions/essence-lab.ts), after
-- check_access, through the service role. The policies go and browser roles
-- lose INSERT, UPDATE and DELETE; they keep SELECT of their own rows.
--
-- The browser wrote `courses/<slug>` for standalone courses, a format no
-- reader looks for (they all read `foundations/<slug>`), so those courses
-- never showed as mastered. Existing rows are renamed; a row whose
-- `foundations/` twin already exists is dropped instead.
--
-- 2. PAY-001 (migrations 27 and 37)
-- ---------------------------------
-- The line-item maps from migration 37 replace the single columns. Backfill
-- again, for anything the old code wrote between 37 and the deploy, then drop
-- the single columns.
--
-- Rollback (the policies and grants; the dropped columns come back empty and
-- are not read by the code any more):
--   GRANT INSERT, UPDATE, DELETE ON public.user_progress TO anon, authenticated;
--   CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT
--       WITH CHECK ((auth.uid() IS NOT NULL) AND (user_id = auth.uid()));
--   CREATE POLICY "Users can update own progress." ON public.user_progress FOR INSERT
--       WITH CHECK (((SELECT auth.uid() AS uid) = user_id));
--   ALTER TABLE public.profiles ADD COLUMN access_term_line_item text;
--   ALTER TABLE public.user_access_grants ADD COLUMN term_line_item text;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_term_line_items') THEN
        RAISE EXCEPTION 'profiles.access_term_line_items is missing; apply migration 37 first';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_term_line_item') THEN
        RAISE EXCEPTION 'profiles.access_term_line_item is gone; migration 38 has been applied';
    END IF;
END $$;

-- 1. Course progress
DROP POLICY "Users can insert own progress" ON public.user_progress;
DROP POLICY "Users can update own progress." ON public.user_progress;
REVOKE INSERT, UPDATE, DELETE ON public.user_progress FROM anon, authenticated;

DELETE FROM public.user_progress c
WHERE c.content_id LIKE 'courses/%'
  AND EXISTS (SELECT 1 FROM public.user_progress f
              WHERE f.user_id = c.user_id AND f.content_id = 'foundations/' || substr(c.content_id, 9));
UPDATE public.user_progress
SET content_id = 'foundations/' || substr(content_id, 9)
WHERE content_id LIKE 'courses/%';

-- 2. PAY-001
UPDATE public.profiles
SET access_term_line_items = access_term_line_items || jsonb_build_object(access_term_line_item, true)
WHERE access_term_line_item IS NOT NULL;
UPDATE public.user_access_grants
SET term_line_items = term_line_items || jsonb_build_object(term_line_item, true)
WHERE term_line_item IS NOT NULL;

ALTER TABLE public.profiles DROP COLUMN access_term_line_item;
ALTER TABLE public.user_access_grants DROP COLUMN term_line_item;

COMMIT;
