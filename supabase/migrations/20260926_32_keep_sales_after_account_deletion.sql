-- Migration 32 — a deleted account's sales stay recorded, detached from it
--
-- The problem (found by the owner 2026-09-26; demonstrated in
-- tests/integration/fulfillment.test.ts, against the live schema)
-- -----------------------------------------------------------------------
-- A guest purchase belongs to its email: the Stripe session carries no
-- account id. fulfillments.user_id and purchases.user_id were
-- ON DELETE CASCADE, so deleting an account (or a wipe) erased the record that
-- its line items had been settled. The next person to sign up with that
-- address and press Restore was handed every old guest purchase for it,
-- free — in the owner's test, Full Access from a checkout made six days
-- earlier. Owner decision 2026-09-26: deleting an account closes its
-- purchases.
--
-- What this does
-- --------------
-- Both foreign keys become ON DELETE SET NULL, and both columns nullable. A
-- deleted account's fulfilment rows survive with user_id NULL, so Restore
-- (and a late webhook) find the line item already settled and grant nothing;
-- its purchases survive the same way, as the sales record the 2026-09-25
-- assessment noted was lost on deletion. Nothing that reads these tables by
-- user_id sees a detached row: RLS on purchases is user_id = auth.uid(), and
-- the app only ever filters by the signed-in user.
--
-- Safety
-- ------
-- Constraint changes only; no data touched. The DO block refuses if either
-- column is already nullable.
--
-- Rollback (only while no row has a NULL user_id):
--   ALTER TABLE public.fulfillments ALTER COLUMN user_id SET NOT NULL;
--   ALTER TABLE public.purchases ALTER COLUMN user_id SET NOT NULL;
--   and recreate both FKs with ON DELETE CASCADE.

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name IN ('fulfillments', 'purchases')
                 AND column_name = 'user_id' AND is_nullable = 'YES') THEN
        RAISE EXCEPTION 'fulfillments/purchases user_id already nullable; migration 32 has been applied';
    END IF;
END $$;

ALTER TABLE public.fulfillments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.fulfillments DROP CONSTRAINT fulfillments_user_id_fkey;
ALTER TABLE public.fulfillments ADD CONSTRAINT fulfillments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.purchases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.purchases DROP CONSTRAINT purchases_user_id_fkey;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
