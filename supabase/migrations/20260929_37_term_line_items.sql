-- Migration 37 — a term remembers every line item that extended it
--
-- The problem (PAY-001's stated limit, migration 27)
-- --------------------------------------------------
-- Migration 27 made a term extension idempotent per paid line item by
-- stamping the line item on the term in the same write as the extension. It
-- kept only the LAST one (profiles.access_term_line_item,
-- user_access_grants.term_line_item). So a fulfilment that crashed after
-- extending, whose term was then extended by a DIFFERENT purchase before its
-- own retry (15+ minutes later), found another id there and extended again:
-- a free year.
--
-- What this does
-- --------------
-- Adds, beside each single column, a jsonb map of every line item that has
-- extended the term: {"<line item id>": true, ...}. app/lib/access-logic.ts
-- reads and writes it in the same compare-and-set UPDATE as the extension, so
-- a crash still cannot separate the two, and a retry finds its own id however
-- many purchases came after it. Backfilled from the single columns.
--
-- Additive and safe with the code live when it is applied (which keeps using
-- the single columns). Migration 38 backfills again, for anything written
-- between the two, and drops the single columns once the new code is live.
--
-- Privileges: profiles grants members UPDATE on named columns only, so the
-- new column is not member-writable; user_access_grants has no member write
-- policy. Readable by the owner, like the column it replaces.
--
-- Rollback: ALTER TABLE public.profiles DROP COLUMN access_term_line_items;
--           ALTER TABLE public.user_access_grants DROP COLUMN term_line_items;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_term_line_items') THEN
        RAISE EXCEPTION 'profiles.access_term_line_items exists; migration 37 has been applied';
    END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN access_term_line_items jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_access_grants ADD COLUMN term_line_items jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.profiles
SET access_term_line_items = jsonb_build_object(access_term_line_item, true)
WHERE access_term_line_item IS NOT NULL;

UPDATE public.user_access_grants
SET term_line_items = jsonb_build_object(term_line_item, true)
WHERE term_line_item IS NOT NULL;

COMMENT ON COLUMN public.profiles.access_term_line_items IS
    'Every Stripe line item that extended the pass term, as keys. A retry finds its own id and does nothing (PAY-001; migrations 27, 37).';
COMMENT ON COLUMN public.user_access_grants.term_line_items IS
    'Every Stripe line item that extended this grant, as keys. A retry finds its own id and does nothing (PAY-001; migrations 27, 37).';

COMMIT;
