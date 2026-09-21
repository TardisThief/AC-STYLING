-- Migration 19 — the Masterclass Pass entitlement
--
-- The problem
-- -----------
-- The Vault sells three things: single masterclasses, `full_access` (everything)
-- and `course_pass` (standalone courses only). Nothing covers "every
-- masterclass", which is exactly the catalogue at launch: four masterclasses
-- and no published standalone course. The launch offer is therefore a new
-- `masterclass_pass` offer; `full_access` and `course_pass` are switched off in
-- admin (offers.active = false) until the first course ships.
--
-- What this does
-- --------------
-- 1. `profiles.has_masterclass_pass` — the fast gate, like the other two flags.
--    It covers masterclasses published after purchase too (owner decision
--    2026-09-21), which is why it is a flag and not one grant row per
--    masterclass. Which offer was bought, and when, is still recorded in
--    user_access_grants.offer_slug by grantAccessForProduct().
-- 2. check_access() gains one branch: with the pass, a masterclass or a module
--    that belongs to one is accessible. A standalone course is not.
--
-- The offers row itself is NOT inserted here. It is created from the admin
-- panel, whose generator creates the Stripe product and price.
--
-- Safety
-- ------
-- Additive column, default false, no backfill: nobody holds the pass yet.
-- Migration 12 revoked table-level INSERT/UPDATE on profiles and allowlists
-- editable columns, so a new column is not user-writable; the REVOKE below
-- restates that for this column rather than relying on it silently.
-- check_access() is replaced with the baseline body plus one branch. The DO
-- block refuses to run if the live function no longer carries the clauses this
-- body was copied from, so an unrecorded live edit is never overwritten.
--
-- Rollback (restores the baseline check_access and drops the flag):
--   run the check_access definition from 00000000000000_baseline.sql, then
--   ALTER TABLE public.profiles DROP COLUMN has_masterclass_pass;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    src text;
BEGIN
    SELECT prosrc INTO src FROM pg_proc
    WHERE oid = 'public.check_access(uuid,uuid)'::regprocedure;

    IF src NOT LIKE '%user_profile.has_full_unlock THEN RETURN true%'
       OR src NOT LIKE '%user_profile.has_course_pass%'
       OR src NOT LIKE '%is_standalone = true%'
       OR src NOT LIKE '%parent_masterclass_id%' THEN
        RAISE EXCEPTION 'live check_access() differs from the baseline this migration extends; inspect before applying';
    END IF;

    IF src LIKE '%has_masterclass_pass%' THEN
        RAISE EXCEPTION 'check_access() already references has_masterclass_pass';
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS has_masterclass_pass boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_masterclass_pass IS
    'Masterclass Pass: every masterclass (current and future) and its modules. Not standalone courses.';

REVOKE INSERT (has_masterclass_pass), UPDATE (has_masterclass_pass)
    ON public.profiles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    user_profile public.profiles%ROWTYPE;
    is_standalone_course boolean;
    parent_masterclass_id uuid;
BEGIN
    -- 1. Fetch User Profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = check_user_id;
    IF user_profile IS NULL THEN RETURN false; END IF;

    -- 2. Global Overrides
    IF user_profile.role = 'admin' OR user_profile.has_full_unlock THEN RETURN true; END IF;

    -- 3. Masterclass Pass: a masterclass, or a module that belongs to one
    IF user_profile.has_masterclass_pass THEN
        IF EXISTS (SELECT 1 FROM public.masterclasses WHERE id = check_object_id)
           OR EXISTS (SELECT 1 FROM public.chapters WHERE id = check_object_id AND masterclass_id IS NOT NULL) THEN
            RETURN true;
        END IF;
    END IF;

    -- 4. Course Pass Logic
    IF user_profile.has_course_pass THEN
        SELECT EXISTS (SELECT 1 FROM public.chapters WHERE id = check_object_id AND is_standalone = true) INTO is_standalone_course;
        IF is_standalone_course THEN RETURN true; END IF;
    END IF;

    -- 5. Direct Grant Check
    IF EXISTS (SELECT 1 FROM public.user_access_grants WHERE user_id = check_user_id AND (masterclass_id = check_object_id OR chapter_id = check_object_id)) THEN RETURN true; END IF;

    -- 6. Parent Masterclass Check (Inheritance)
    SELECT masterclass_id INTO parent_masterclass_id FROM public.chapters WHERE id = check_object_id;
    IF parent_masterclass_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.user_access_grants WHERE user_id = check_user_id AND masterclass_id = parent_masterclass_id) THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$;

COMMENT ON COLUMN public.user_access_grants.offer_slug IS
  'offers.slug for an offer purchase (full_access / course_pass / masterclass_pass). Founding-cohort record; granted_at is the purchase time.';

COMMIT;
