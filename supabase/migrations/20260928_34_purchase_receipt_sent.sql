-- Migration 34 — remember that a checkout's receipt was sent
--
-- The problem (found in the 2026-09-28 paid-path rehearsal)
-- ---------------------------------------------------------
-- A buyer who already had an account received no email at all when she paid:
-- the only purchase email is the welcome, and it goes only to an account that
-- has never been signed in. Owner decision 2026-09-28: every other paid
-- checkout gets a branded receipt, in her language.
--
-- A receipt must go once per checkout. The webhook runs for every paid
-- session, but Stripe redelivers events, two deliveries can run at once, and
-- her own checkout return can settle the line items first — so "did this
-- delivery grant something" does not say whether the receipt went. Nothing
-- durable recorded it.
--
-- What this does
-- --------------
-- Adds fulfillments.receipt_sent_at. The webhook claims it for every row of
-- the session in one UPDATE ... WHERE receipt_sent_at IS NULL RETURNING; row
-- locks make a concurrent claim see the first one's write and return no rows,
-- so exactly one delivery sends. A failed send clears the claim again. The
-- welcome email counts as the receipt for a new account and takes the same
-- claim, so a later replay does not add a receipt to it.
--
-- fulfillments is service-role only (RLS forced, no policies), so no grants or
-- policies change.
--
-- Safety
-- ------
-- Additive, nullable, no default: a catalogue-only change on a table of a few
-- rows, no rewrite. Existing rows stay NULL; their sessions are already
-- settled and no delivery is pending for them, so none will be sent a receipt
-- retroactively unless Stripe redelivers one (it would then get its receipt).
-- The DO block refuses if the column already exists.
--
-- Rollback: ALTER TABLE public.fulfillments DROP COLUMN receipt_sent_at;
-- (deploy code that does not read it first).

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'fulfillments'
                 AND column_name = 'receipt_sent_at') THEN
        RAISE EXCEPTION 'fulfillments.receipt_sent_at exists; migration 34 has been applied';
    END IF;
END $$;

ALTER TABLE public.fulfillments ADD COLUMN receipt_sent_at timestamptz;

COMMENT ON COLUMN public.fulfillments.receipt_sent_at IS
    'When this checkout''s purchase email (receipt, or the welcome for a new account) was sent. Claimed for all of a session''s rows at once; see migration 34.';

COMMIT;
