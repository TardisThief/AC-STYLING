-- Migration 25 — get_user_role answers only for the caller
--
-- The problem (demonstrated in tests/integration/access-control.test.ts,
-- against the live schema)
-- -----------------------------------------------------------------------
-- get_user_role(uuid) is SECURITY DEFINER, EXECUTE-granted to anon, and
-- returns the role of whatever user id it is given. PostgREST exposes it as
-- /rpc/get_user_role, so anyone holding a UUID can learn whether it belongs to
-- the admin. Same shape as check_access before migration 22.
--
-- What this does
-- --------------
-- Returns NULL unless the id asked about is the caller's own (or the service
-- role is asking). Every caller in the schema is an RLS policy of the form
-- get_user_role(auth.uid()) or get_user_role((SELECT auth.uid())), and no app
-- code calls it, so no legitimate answer changes.
--
-- EXECUTE stays granted to anon: those policies are evaluated for anonymous
-- queries too, and revoking it would turn an empty result into an error.
--
-- Safety
-- ------
-- One function body replaced; no data touched. The DO block refuses unless
-- the live body is the baseline one.
--
-- Rollback: re-run the get_user_role definition from the baseline.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    src text;
BEGIN
    SELECT prosrc INTO src FROM pg_proc WHERE oid = 'public.get_user_role(uuid)'::regprocedure;
    IF src LIKE '%auth.uid()%' THEN
        RAISE EXCEPTION 'get_user_role() already restricts the caller; migration 25 has been applied';
    END IF;
    IF btrim(regexp_replace(src, '\s+', ' ', 'g')) <> 'SELECT role FROM public.profiles WHERE id = user_id;' THEN
        RAISE EXCEPTION 'live get_user_role() differs from the baseline (%); inspect before applying', src;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles
  WHERE id = user_id
    AND (user_id = auth.uid() OR coalesce(auth.role(), '') = 'service_role');
$$;

COMMIT;
