-- Migration 27 — remember which paid line item last extended a term
--
-- The problem (demonstrated in tests/integration/fulfillment.test.ts,
-- against the live schema; found by the 2026-09-25 external assessment,
-- PAY-001)
-- -----------------------------------------------------------------------
-- Fulfilment grants a year, then records the line item 'completed' — two
-- writes. A run that dies between them, or whose attempts to record
-- completion all fail, leaves the line item 'processing'; after
-- STALE_CLAIM_MS it is re-claimed and granted again. Since migration 21 a
-- grant is a year, so the retry hands out a free one.
--
-- What this does
-- --------------
-- Adds one nullable text column to each place a term lives:
--   profiles.access_term_line_item       (the three passes share one term)
--   user_access_grants.term_line_item    (one single masterclass or course)
-- app/lib/access-logic.ts stamps the Stripe line item id in the SAME
-- compare-and-set write that extends the term, and a grant that finds its own
-- line item already stamped there does nothing. The extension and the record
-- of it can no longer be separated by a crash.
--
-- Limit, stated rather than hidden: only the LAST line item is kept. A
-- crashed run whose term is extended by a different purchase before its own
-- retry (at least 15 minutes later) would still extend twice. That needs a
-- second purchase on the same term inside that window, on top of the crash.
--
-- Privileges: profiles grants members UPDATE on named columns only, so the
-- new column is not member-writable; user_access_grants has no member write
-- policy. Both remain readable by their owner, which exposes nothing: it is
-- her own Stripe line item id.
--
-- Safety
-- ------
-- Additive: two nullable columns, no default, no backfill, no data touched.
-- The DO block refuses if either column already exists.
--
-- Rollback:
--   ALTER TABLE public.profiles DROP COLUMN access_term_line_item;
--   ALTER TABLE public.user_access_grants DROP COLUMN term_line_item;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_term_line_item')
       OR EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'user_access_grants' AND column_name = 'term_line_item') THEN
        RAISE EXCEPTION 'term line item columns exist; migration 27 has been applied';
    END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN access_term_line_item text;
ALTER TABLE public.user_access_grants ADD COLUMN term_line_item text;

COMMENT ON COLUMN public.profiles.access_term_line_item IS
    'Stripe line item id that last extended access_expires_at; a re-run of that line item does not extend again (migration 27).';
COMMENT ON COLUMN public.user_access_grants.term_line_item IS
    'Stripe line item id that last extended expires_at; a re-run of that line item does not extend again (migration 27).';

COMMIT;
