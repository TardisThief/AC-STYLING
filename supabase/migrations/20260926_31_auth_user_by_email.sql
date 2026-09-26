-- Migration 31 — look an account up by email without paging through everyone
--
-- The problem (2026-09-25 external assessment, SCALE-001; demonstrated in
-- tests/unit/guest-purchase.test.ts and tests/unit/claim-purchase.test.ts)
-- -----------------------------------------------------------------------
-- The Stripe webhook (guest purchases) and the /welcome page find an account
-- by email. supabase-js's admin listUsers has no email filter, so both paged
-- through at most 10 x 200 users. Past the 2,000th account a returning buyer
-- was not found: the webhook's createUser then failed "already registered",
-- the re-resolve failed the same way, and Stripe got 500 for ever.
--
-- What this does
-- --------------
-- public.auth_user_id_by_email(p_email): the id of the auth user with that
-- address (case-insensitive), or NULL. SECURITY DEFINER to read auth.users;
-- EXECUTE for service_role only — it would otherwise tell anyone whether an
-- address has an account. Returns only the id; the caller reads the user
-- through the admin API as before.
--
-- Safety
-- ------
-- One new function; no data touched. Refuses if it already exists.
--
-- Rollback: DROP FUNCTION public.auth_user_id_by_email(text);

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF to_regprocedure('public.auth_user_id_by_email(text)') IS NOT NULL THEN
        RAISE EXCEPTION 'auth_user_id_by_email exists; migration 31 has been applied';
    END IF;
END $$;

CREATE FUNCTION public.auth_user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

COMMENT ON FUNCTION public.auth_user_id_by_email(text) IS
    'Id of the auth user with this email, or NULL (migration 31). Service role only: it would otherwise reveal which addresses have accounts.';

COMMIT;
