-- Migration 28 — every intake token expires; assigning a wardrobe is one step
--
-- The problems (demonstrated in tests/integration/studio-lifecycle.test.ts,
-- against the live schema; found by the 2026-09-25 external assessment,
-- STUDIO-001 and STUDIO-002)
-- -----------------------------------------------------------------------
-- 1. Every wardrobe has a bearer intake token (upload_token defaults to
--    gen_random_uuid()), but upload_token_expires_at had no default and
--    allowed NULL, which the token check reads as "never expires". Migration
--    16 added the column and made the code paths it knew about set it; four
--    insert paths (createWardrobe, getMyWardrobe, onboarding, Studio
--    activation) still did not. Fixing each call site leaves the next one to
--    forget, so the database now supplies the expiry.
-- 2. assignWardrobe made three separate writes — owner, the new owner's
--    Studio flag, the items' user_id — logged two of the failures, and
--    answered success regardless, including for a wardrobe that did not exist.
--
-- What this does
-- --------------
-- 1. upload_token_expires_at DEFAULT now() + 7 days (UPLOAD_TOKEN_TTL_DAYS in
--    app/lib/wardrobe-tokens.ts, the owner's 2026-09-20 decision), backfills
--    any NULL the same way, then SET NOT NULL.
-- 2. public.assign_wardrobe(p_wardrobe_id, p_user_id): the three writes in
--    one transaction, raising if the wardrobe or the profile does not exist.
--    SECURITY INVOKER and EXECUTE for service_role only: it is called by the
--    admin action after requireAdmin(), never from a browser.
--
-- Not done here, recorded: objects already stored under a previous owner's
-- folder stay there after reassignment (the bucket policy is owner-or-admin by
-- path). Assignment is used for ownerless intake wardrobes, whose objects live
-- under wardrobe/<id>/; moving objects between owners is left until a
-- reassignment between two real clients is needed.
--
-- Safety
-- ------
-- Live state checked 2026-09-26: 1 wardrobe, 0 NULL expiries, so the backfill
-- is a no-op there. The DO block refuses if the column is already NOT NULL.
--
-- Rollback:
--   ALTER TABLE public.wardrobes ALTER COLUMN upload_token_expires_at DROP NOT NULL,
--                                ALTER COLUMN upload_token_expires_at DROP DEFAULT;
--   DROP FUNCTION public.assign_wardrobe(uuid, uuid);

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'wardrobes'
                 AND column_name = 'upload_token_expires_at' AND is_nullable = 'NO') THEN
        RAISE EXCEPTION 'upload_token_expires_at is already NOT NULL; migration 28 has been applied';
    END IF;
    IF to_regprocedure('public.assign_wardrobe(uuid, uuid)') IS NOT NULL THEN
        RAISE EXCEPTION 'assign_wardrobe exists; migration 28 has been applied';
    END IF;
END $$;

ALTER TABLE public.wardrobes
    ALTER COLUMN upload_token_expires_at SET DEFAULT (now() + interval '7 days');

UPDATE public.wardrobes
   SET upload_token_expires_at = now() + interval '7 days'
 WHERE upload_token_expires_at IS NULL;

ALTER TABLE public.wardrobes
    ALTER COLUMN upload_token_expires_at SET NOT NULL;

CREATE FUNCTION public.assign_wardrobe(p_wardrobe_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO ''
    AS $$
BEGIN
    UPDATE public.wardrobes SET owner_id = p_user_id, updated_at = now() WHERE id = p_wardrobe_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'wardrobe % does not exist', p_wardrobe_id USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles SET active_studio_client = true WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile % does not exist', p_user_id USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.wardrobe_items SET user_id = p_user_id WHERE wardrobe_id = p_wardrobe_id;
END $$;

REVOKE ALL ON FUNCTION public.assign_wardrobe(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_wardrobe(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.assign_wardrobe(uuid, uuid) IS
    'Give a wardrobe, its items and Studio access to one client in a single transaction (migration 28). Service role only.';

COMMIT;
