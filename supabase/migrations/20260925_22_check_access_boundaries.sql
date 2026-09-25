-- Migration 22 — check_access answers only for the caller, and only a real
-- course is a course
--
-- The problems (both demonstrated in tests/integration/access-control.test.ts,
-- against the live schema)
-- -----------------------------------------------------------------------------
-- 1. A Course Pass holder can open a masterclass module. The Course Pass branch
--    accepts any chapter with `is_standalone = true`, but that column DEFAULTS
--    to true and nothing in the database ties it to `masterclass_id`. Only the
--    admin form (chapterSchema) forces it false for a module. Any other write
--    path that leaves it out -- a script, the SQL editor, an importer -- makes
--    a module that the pass treats as a standalone course. Migration 17 found
--    six such rows live, so this is not hypothetical.
--
-- 2. check_access tells anyone what anyone else owns. It is SECURITY DEFINER,
--    EXECUTE-granted to anon, and takes the user id as an argument. PostgREST
--    exposes it directly, so anyone holding a user's UUID (they appear in
--    storage paths) can call /rpc/check_access and learn what that user bought.
--
-- What this does
-- --------------
-- 1. The Course Pass branch also requires `masterclass_id IS NULL`. The gate
--    stops depending on the data being right.
-- 2. The function returns false unless `check_user_id` is the caller's own id.
--    The service role is exempt so server code can still ask on someone's
--    behalf. EXECUTE is revoked from anon and PUBLIC. Every app caller
--    (utils/access-control.ts, app/actions/vault/chapter-video.ts) is signed in
--    and passes its own session's id, so no legitimate caller changes answer.
--
-- Deliberately NOT here
-- ---------------------
-- A CHECK (masterclass_id IS NULL OR is_standalone = false) would also stop
-- the contradictory rows from existing. It needs a live data check first and
-- could reject inserts from write paths that rely on the default, so it is left
-- as a separate decision. With (1) in place the rows are harmless to the gate.
--
-- Safety
-- ------
-- Function body replacement plus one REVOKE; no data touched. The DO block
-- refuses to run unless the live function is migration 21's body, so an
-- unrecorded live edit is never overwritten.
--
-- Rollback:
--   run the check_access definition from 20260924_21_access_term.sql, then
--   GRANT EXECUTE ON FUNCTION public.check_access(uuid, uuid) TO anon;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    src text;
BEGIN
    SELECT prosrc INTO src FROM pg_proc
    WHERE oid = 'public.check_access(uuid,uuid)'::regprocedure;

    IF src LIKE '%auth.uid()%' THEN
        RAISE EXCEPTION 'check_access() already restricts the caller; migration 22 has been applied';
    END IF;

    IF src NOT LIKE '%passes_live%'
       OR src NOT LIKE '%is_standalone = true) INTO is_standalone_course%'
       OR src NOT LIKE '%parent_masterclass_id%' THEN
        RAISE EXCEPTION 'live check_access() differs from migration 21, which this extends; inspect before applying';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_access(check_user_id uuid, check_object_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    user_profile public.profiles%ROWTYPE;
    is_standalone_course boolean;
    parent_masterclass_id uuid;
    passes_live boolean;
BEGIN
    -- 0. Only the caller's own entitlements, unless the server is asking.
    IF check_user_id IS DISTINCT FROM auth.uid()
       AND coalesce(auth.role(), '') <> 'service_role' THEN
        RETURN false;
    END IF;

    -- 1. Fetch User Profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = check_user_id;
    IF user_profile IS NULL THEN RETURN false; END IF;

    -- 2. Admin. Not an entitlement and so not subject to the term.
    IF user_profile.role = 'admin' THEN RETURN true; END IF;

    -- A null expiry is perpetual access, sold before the term existed.
    passes_live := user_profile.access_expires_at IS NULL
                   OR user_profile.access_expires_at > now();

    -- 3. Full unlock
    IF user_profile.has_full_unlock AND passes_live THEN RETURN true; END IF;

    -- 4. Masterclass Pass: a masterclass, or a module that belongs to one
    IF user_profile.has_masterclass_pass AND passes_live THEN
        IF EXISTS (SELECT 1 FROM public.masterclasses WHERE id = check_object_id)
           OR EXISTS (SELECT 1 FROM public.chapters WHERE id = check_object_id AND masterclass_id IS NOT NULL) THEN
            RETURN true;
        END IF;
    END IF;

    -- 5. Course Pass: a standalone course, which by definition belongs to no
    --    masterclass. Both conditions, so a module mis-flagged standalone is
    --    still a module.
    IF user_profile.has_course_pass AND passes_live THEN
        SELECT EXISTS (
            SELECT 1 FROM public.chapters
            WHERE id = check_object_id AND is_standalone = true AND masterclass_id IS NULL
        ) INTO is_standalone_course;
        IF is_standalone_course THEN RETURN true; END IF;
    END IF;

    -- 6. Direct Grant Check
    IF EXISTS (
        SELECT 1 FROM public.user_access_grants
        WHERE user_id = check_user_id
          AND (masterclass_id = check_object_id OR chapter_id = check_object_id)
          AND (expires_at IS NULL OR expires_at > now())
    ) THEN RETURN true; END IF;

    -- 7. Parent Masterclass Check (Inheritance)
    SELECT masterclass_id INTO parent_masterclass_id FROM public.chapters WHERE id = check_object_id;
    IF parent_masterclass_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.user_access_grants
            WHERE user_id = check_user_id
              AND masterclass_id = parent_masterclass_id
              AND (expires_at IS NULL OR expires_at > now())
        ) THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_access(uuid, uuid) TO authenticated, service_role;

COMMIT;
