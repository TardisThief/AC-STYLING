-- Migration 21 — the one-year access term and the thirds ladder
--
-- The problem
-- -----------
-- Vault access has been perpetual since the first sale: a purchase sets a
-- profile flag (has_full_unlock / has_course_pass / has_masterclass_pass) or
-- inserts a user_access_grants row, and neither has ever carried an end date.
-- The Vault now sells a one-year term with a renewal that steps down in thirds
-- (year one at the price paid, year two at two thirds, year three onward at one
-- third), so the database needs somewhere to put the end date and the rung.
--
-- What this does
-- --------------
-- 1. profiles.access_expires_at   — when the profile-level passes lapse.
--    profiles.access_renewal_count — rungs climbed; reset to 0 after a lapse.
-- 2. user_access_grants.expires_at / .renewal_count — the same two facts for a
--    single masterclass or chapter bought on its own.
-- 3. purchases.is_renewal — so the "what did she originally pay" lookup that
--    prices a renewal cannot read a renewal and compound the discount.
-- 4. check_access() refuses expired entitlements.
--
-- One expiry column rather than one per pass flag: only one offer is ever
-- `active` at a time (see migration 19), so in practice the three flags move
-- together, and three columns would be three chances to update two of them.
-- If two passes are ever sold concurrently this has to be revisited.
--
-- The 30-day renewal grace is deliberately NOT here. Grace holds the *price*,
-- not the access — the Vault locks on the expiry date and the discount survives
-- it for a month. That rule belongs to the checkout code (app/lib/
-- entitlement-period.ts), not to the gate.
--
-- Safety
-- ------
-- Every column is additive. The expiry columns are nullable with NO backfill,
-- and NULL means "never expires" everywhere it is read — so every buyer from
-- before this migration keeps the perpetual access she was actually sold. That
-- is the whole reason the column is nullable rather than NOT NULL DEFAULT.
--
-- Migration 12 revoked table-level INSERT/UPDATE on profiles and allowlists the
-- editable columns, so the new columns are not user-writable; the REVOKE below
-- restates that rather than relying on it silently.
--
-- check_access() is replaced with the migration-19 body plus the expiry guards.
-- The DO block refuses to run if the live function is not the one this body was
-- copied from, so an unrecorded live edit is never overwritten.
--
-- Rollback:
--   run the check_access definition from 20260921_19_masterclass_pass.sql, then
--   ALTER TABLE public.profiles DROP COLUMN access_expires_at, DROP COLUMN access_renewal_count;
--   ALTER TABLE public.user_access_grants DROP COLUMN expires_at, DROP COLUMN renewal_count;
--   ALTER TABLE public.purchases DROP COLUMN is_renewal;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    src text;
BEGIN
    SELECT prosrc INTO src FROM pg_proc
    WHERE oid = 'public.check_access(uuid,uuid)'::regprocedure;

    -- "Already applied" is checked FIRST. This migration rewrites the very
    -- clauses the shape check below looks for, so on a re-run that check fails
    -- too -- and would report drift, sending the next reader to inspect a
    -- function that is simply already correct.
    IF src LIKE '%access_expires_at%' THEN
        RAISE EXCEPTION 'check_access() already carries the access term; migration 21 has been applied';
    END IF;

    IF src NOT LIKE '%user_profile.has_full_unlock THEN RETURN true%'
       OR src NOT LIKE '%has_masterclass_pass%'
       OR src NOT LIKE '%user_profile.has_course_pass%'
       OR src NOT LIKE '%is_standalone = true%'
       OR src NOT LIKE '%parent_masterclass_id%' THEN
        RAISE EXCEPTION 'live check_access() differs from migration 19, which this extends; inspect before applying';
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS access_renewal_count smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.access_expires_at IS
    'When the profile-level passes lapse. NULL means never — a buyer from before the one-year term, who keeps the perpetual access she was sold.';
COMMENT ON COLUMN public.profiles.access_renewal_count IS
    'Rungs climbed on the renewal ladder: 0 = next renewal costs two thirds, 1+ = one third. Reset to 0 by a full-price purchase after a lapse.';

REVOKE INSERT (access_expires_at), UPDATE (access_expires_at)
    ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT (access_renewal_count), UPDATE (access_renewal_count)
    ON public.profiles FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_access_grants
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS renewal_count smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_access_grants.expires_at IS
    'When this single item lapses. NULL means never, for grants written before the one-year term and for admin_override/bonus grants.';
COMMENT ON COLUMN public.user_access_grants.renewal_count IS
    'Rungs climbed on the renewal ladder for this item. Same meaning as profiles.access_renewal_count.';

ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS is_renewal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.purchases.is_renewal IS
    'True when this payment was a renewal. The renewal price is two thirds / one third of the most recent purchase where this is false, so that a renewal is never priced off another renewal.';

-- Finding "her most recent non-renewal purchase of this product" is on the path
-- of every renewal checkout.
CREATE INDEX IF NOT EXISTS purchases_user_product_original_idx
    ON public.purchases (user_id, product_id, created_at DESC)
    WHERE is_renewal = false;

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

    -- 5. Course Pass Logic
    IF user_profile.has_course_pass AND passes_live THEN
        SELECT EXISTS (SELECT 1 FROM public.chapters WHERE id = check_object_id AND is_standalone = true) INTO is_standalone_course;
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

COMMIT;
