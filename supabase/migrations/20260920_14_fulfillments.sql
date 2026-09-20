-- Migration 14 — durable, per-line-item fulfillment records
--
-- Closes the remainder of F05 in docs/ASSESSMENT-2026-09-19.md.
--
-- The problem
-- -----------
-- Fulfillment state lived only in `stripe_processed_events`, which records
-- that an *event* was seen — not that the work it implied actually finished.
-- Three consequences:
--
--   1. A session with several line items had no per-item record, so a failure
--      on item 3 meant retrying items 1 and 2 as well. `purchases` has no
--      unique key, so that retry duplicated their rows.
--   2. The marker is written before the work and only removed when the handler
--      throws. An abrupt termination — a function timeout, an instance
--      recycled mid-run — leaves the event permanently "processed" with the
--      work half done and no retry possible.
--   3. Nothing recorded *why* a fulfillment failed, so a buyer reporting no
--      access could only be investigated by reading logs.
--
-- What this adds
-- --------------
-- One row per Stripe line item, unique on the line item id, carrying an
-- explicit status. The unique constraint is the idempotency boundary: a
-- replayed delivery re-finds the row rather than redoing the work, and a row
-- already `completed` is skipped. A row stuck in `processing` is visible as
-- exactly that, rather than looking identical to a finished one.
--
-- `purchases` also gains a unique index on the line item id, so the duplicate
-- rows described above become impossible at the database rather than by
-- convention. It is a partial index on non-null values, so the historical
-- rows (which predate the column) are unaffected.
--
-- Safety
-- ------
-- Additive. New table, one new nullable column on `purchases`, one partial
-- unique index. Nothing existing changes shape or loses data, so this can be
-- applied before the code that uses it.
--
-- Live state checked before writing: 5 rows in `purchases`, all with
-- `stripe_line_item_id` necessarily null, so the partial index is created on
-- an empty set and cannot conflict.
--
-- Rollback:
--   DROP TABLE public.fulfillments;
--   DROP INDEX IF EXISTS public.purchases_line_item_unique;
--   ALTER TABLE public.purchases DROP COLUMN IF EXISTS stripe_line_item_id;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.fulfillments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The idempotency key. Stripe line item ids are stable across redeliveries
    -- of the same session, which is exactly the property needed here.
    stripe_line_item_id text NOT NULL UNIQUE,

    stripe_session_id text NOT NULL,

    -- Which delivery most recently touched this row. Not unique: a retry after
    -- a failure legitimately arrives under a different event id.
    stripe_event_id text NOT NULL,

    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    stripe_product_id text NOT NULL,

    -- Denormalised from the line item so an investigation does not need a
    -- Stripe API call.
    amount_total integer,
    currency text,

    -- processing -> completed, or processing -> failed and retried.
    -- 'unfulfillable' is terminal and deliberate: the payment is real but the
    -- product matches no content we grant (a service booking), so there is
    -- nothing to do and retrying forever would be wrong.
    status text NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'completed', 'failed', 'unfulfillable')),

    attempts integer NOT NULL DEFAULT 0,
    last_error text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- "What is stuck or broken right now" — the query an operator actually runs.
CREATE INDEX IF NOT EXISTS fulfillments_unfinished_idx
    ON public.fulfillments (status, updated_at)
    WHERE status IN ('processing', 'failed');

CREATE INDEX IF NOT EXISTS fulfillments_session_idx
    ON public.fulfillments (stripe_session_id);

CREATE INDEX IF NOT EXISTS fulfillments_user_idx
    ON public.fulfillments (user_id);

-- Server-owned, like purchase_claims. RLS on with no policies denies anything
-- that is not the service role; the REVOKE guards against Supabase's default
-- grants to anon/authenticated on new public tables.
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.fulfillments FROM PUBLIC;
REVOKE ALL ON public.fulfillments FROM anon;
REVOKE ALL ON public.fulfillments FROM authenticated;
GRANT ALL ON public.fulfillments TO service_role;

COMMENT ON TABLE public.fulfillments IS
    'One row per Stripe line item, unique on the line item id. The idempotency and retry boundary for payment fulfillment; see migration 14.';

-- Make the duplicate `purchases` rows a replay could create impossible.
ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS stripe_line_item_id text;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_line_item_unique
    ON public.purchases (stripe_line_item_id)
    WHERE stripe_line_item_id IS NOT NULL;

COMMENT ON COLUMN public.purchases.stripe_line_item_id IS
    'Stripe line item id. Null on rows predating migration 14; unique when present, so a replayed webhook cannot duplicate a purchase.';

COMMIT;
