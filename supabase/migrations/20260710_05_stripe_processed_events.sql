-- P1 — Webhook idempotency for the Stripe handler.
--
-- Records each Stripe event.id we have processed so retries / duplicate
-- deliveries (Stripe delivers at-least-once and retries non-2xx for up to 3
-- days) are skipped instead of creating duplicate purchases and grants.
--
-- Additive and non-destructive. The webhook records the event.id atomically at
-- the start of processing (upsert ... on conflict do nothing) and, on a
-- processing failure that returns 500, deletes the row so Stripe's retry can
-- reprocess. The handler fails OPEN if this table is absent, so the code can
-- ship before this migration is applied.

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Lock the table down: RLS on with no policies means anon/authenticated cannot
-- touch it. The service role (used by the webhook) bypasses RLS.
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- Reversible: DROP TABLE public.stripe_processed_events;
