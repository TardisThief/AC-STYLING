-- Migration 13 — server-owned, single-use claim credentials for guest purchases
--
-- Fixes F06 in docs/ASSESSMENT-2026-09-19.md.
--
-- The problem this replaces
-- -------------------------
-- A guest who bought without an account was given a password-setting window
-- keyed by her Stripe checkout session id, gated on
-- `auth.users.raw_user_meta_data->>'pending_password'`. That marker was wrong
-- in two ways:
--
--   1. It was never cleared by the *other* password path. `claimPurchase`
--      cleared it; the emailed recovery link goes through
--      `supabase.auth.updateUser({ password })`, which does not. So a buyer who
--      used the email link — the path we actively recommend — left the
--      session-id window open for the rest of its 24 hours. Anyone holding that
--      id (browser history, a referrer header, a shared device) could overwrite
--      her password and take the account.
--
--   2. `user_metadata` is writable by the user it belongs to. A signed-in
--      account can re-arm its own flag. A field the subject controls cannot be
--      the authority for a security decision about that subject.
--
-- What replaces it
-- ----------------
-- A row in this table is the credential. It is created server-side by the
-- Stripe webhook, it is consumed exactly once by an atomic
-- `UPDATE ... WHERE consumed_at IS NULL RETURNING`, and it is consumed by
-- *every* path that establishes a password — not just the fast lane. Nothing
-- reachable from a browser can read it, write it, or extend it.
--
-- Safety
-- ------
-- Purely additive: a new table nothing currently references. It can be applied
-- before the application code that uses it, and the code fails closed if the
-- table is missing (no claim row found means no fast lane, and the emailed
-- recovery link still works).
--
-- Verified before writing: 0 accounts carry `pending_password`, and 0 are in
-- the exploitable "has a password but still flagged claimable" state, so there
-- is no backfill and no live exposure to close.
--
-- Rollback: DROP TABLE public.purchase_claims;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.purchase_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The account this credential can act on. Cascade so deleting a user
    -- cannot leave a live claim pointing at a recycled id.
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

    -- The Stripe checkout session the buyer returns with. Unique, so a
    -- duplicate webhook delivery cannot mint a second credential for the same
    -- purchase.
    stripe_session_id text NOT NULL UNIQUE,

    -- Recorded for support and for matching the session's payer. Not trusted
    -- as an identifier on its own.
    email text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Short-lived by construction rather than by a check in application code.
    expires_at timestamptz NOT NULL,

    -- Single-use. Non-null means spent; the atomic update below is what makes
    -- two concurrent claims impossible.
    consumed_at timestamptz,

    -- Which path spent it: 'claim' (the session-id fast lane) or 'password_set'
    -- (any other way a password was established). Kept for incident review.
    consumed_reason text
);

-- The only lookup the application makes on the hot path.
CREATE INDEX IF NOT EXISTS purchase_claims_open_by_session_idx
    ON public.purchase_claims (stripe_session_id)
    WHERE consumed_at IS NULL;

-- Used when a password is set by any other route, to close that user's
-- outstanding windows.
CREATE INDEX IF NOT EXISTS purchase_claims_open_by_user_idx
    ON public.purchase_claims (user_id)
    WHERE consumed_at IS NULL;

-- Server-owned. RLS on with no policies denies everything that is not the
-- service role; the REVOKE is belt-and-braces against Supabase's default
-- grants to anon/authenticated on new public tables, which is the same footgun
-- migration 12 had to clean up elsewhere.
ALTER TABLE public.purchase_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_claims FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.purchase_claims FROM PUBLIC;
REVOKE ALL ON public.purchase_claims FROM anon;
REVOKE ALL ON public.purchase_claims FROM authenticated;
GRANT ALL ON public.purchase_claims TO service_role;

COMMENT ON TABLE public.purchase_claims IS
    'Single-use, short-lived credential letting a guest buyer set her first password. Service-role only; see migration 13.';

COMMIT;
