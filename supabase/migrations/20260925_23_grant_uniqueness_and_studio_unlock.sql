-- Migration 23 — one grant per item, and the Studio unlock that never fired
--
-- Both demonstrated in tests/integration/fulfillment.test.ts, end to end
-- through the real webhook, against the live schema.
--
-- 1. user_access_grants has no unique key per item
-- ------------------------------------------------
-- grantItemForTerm() (app/lib/access-logic.ts) inserts a grant and, on a
-- 23505 unique violation, extends the term already held. That is how a
-- single-item renewal is meant to arrive. But the only unique index on the
-- table is (user_id, offer_slug) from migration 11. Nothing is unique per
-- masterclass or per chapter, so the insert never conflicts, the extend
-- branch never runs, and every renewal adds a SECOND row. The renewal quote
-- (resolveRenewal) reads the soonest-expiring row — the old one — so she is
-- told a term she has already renewed is ending, is quoted the two-thirds
-- price every year, and never reaches the one-third rung.
--
-- The unit tests of that branch mocked the insert to return 23505, so they
-- tested a constraint that did not exist.
--
-- 2. on_purchase_created matches the wrong column
-- -----------------------------------------------
-- handle_new_purchase() unlocks the Studio for a service marked
-- unlocks_studio_access by matching services.price_id against
-- purchases.product_id. The webhook writes the Stripe PRODUCT id there
-- (prod_…), never a price id, so the admin form's "unlocks Studio access"
-- checkbox has never had an effect on a purchase.
--
-- What this does
-- --------------
-- 1. Two partial unique indexes: (user_id, masterclass_id) and
--    (user_id, chapter_id), each where the column is not null. Refuses to run
--    if duplicates already exist — merging them is a decision about a
--    customer's term (which expiry, which rung), not something to do blind.
--    Find them with:
--      SELECT user_id, masterclass_id, chapter_id, count(*),
--             array_agg(id ORDER BY expires_at DESC NULLS FIRST) AS grant_ids,
--             array_agg(expires_at ORDER BY expires_at DESC NULLS FIRST) AS expiries
--      FROM public.user_access_grants
--      WHERE masterclass_id IS NOT NULL OR chapter_id IS NOT NULL
--      GROUP BY 1, 2, 3 HAVING count(*) > 1;
-- 2. handle_new_purchase() also matches services.stripe_product_id. The old
--    price_id match is kept, so nothing that ever did match stops matching.
--    Going forward only: buyers of such a service before this migration are
--    NOT backfilled. They are:
--      SELECT p.user_id, p.created_at, s.title FROM public.purchases p
--      JOIN public.services s ON s.stripe_product_id = p.product_id
--      WHERE s.unlocks_studio_access;
--
-- Safety
-- ------
-- Two index builds on a small table, one function body replacement. No data
-- is changed. The DO block refuses on duplicates, and refuses if the live
-- trigger function is not the body this replaces.
--
-- Rollback:
--   DROP INDEX public.user_access_grants_user_masterclass_uniq;
--   DROP INDEX public.user_access_grants_user_chapter_uniq;
--   then re-run the handle_new_purchase definition from the baseline.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
    src text;
    dupes integer;
BEGIN
    SELECT count(*) INTO dupes FROM (
        SELECT 1 FROM public.user_access_grants
        WHERE masterclass_id IS NOT NULL OR chapter_id IS NOT NULL
        GROUP BY user_id, masterclass_id, chapter_id
        HAVING count(*) > 1
    ) d;
    IF dupes > 0 THEN
        RAISE EXCEPTION '% duplicated item grant(s) exist; merge them first (query in this file''s header)', dupes;
    END IF;

    SELECT prosrc INTO src FROM pg_proc WHERE oid = 'public.handle_new_purchase()'::regprocedure;
    IF src LIKE '%stripe_product_id%' THEN
        RAISE EXCEPTION 'handle_new_purchase() already matches stripe_product_id; migration 23 has been applied';
    END IF;
    IF src NOT LIKE '%WHERE price_id = NEW.product_id%' THEN
        RAISE EXCEPTION 'live handle_new_purchase() differs from the baseline this replaces; inspect before applying';
    END IF;
END $$;

CREATE UNIQUE INDEX user_access_grants_user_masterclass_uniq
    ON public.user_access_grants (user_id, masterclass_id)
    WHERE masterclass_id IS NOT NULL;

CREATE UNIQUE INDEX user_access_grants_user_chapter_uniq
    ON public.user_access_grants (user_id, chapter_id)
    WHERE chapter_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    service_unlocks BOOLEAN;
BEGIN
    -- purchases.product_id holds the Stripe product id (prod_…). price_id is
    -- still matched so nothing that ever matched stops matching.
    SELECT unlocks_studio_access INTO service_unlocks
    FROM public.services
    WHERE stripe_product_id = NEW.product_id
       OR price_id = NEW.product_id
    ORDER BY unlocks_studio_access DESC NULLS LAST
    LIMIT 1;

    IF service_unlocks = TRUE THEN
        UPDATE public.profiles
        SET
            active_studio_client = TRUE,
            studio_permissions = jsonb_set(
                jsonb_set(
                    COALESCE(studio_permissions, '{}'::jsonb),
                    '{lookbook}', 'true'
                ),
                '{wardrobe}', 'true'
            )
        WHERE id = NEW.user_id;

        INSERT INTO public.tailor_cards (user_id)
        VALUES (NEW.user_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
