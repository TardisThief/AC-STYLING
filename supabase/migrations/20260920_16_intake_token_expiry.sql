-- Migration 16 — intake tokens expire
--
-- Completes F10 in docs/ASSESSMENT-2026-09-19.md, whose remaining half was
-- "no explicit expiry or per-token upload quota".
--
-- The decision this encodes
-- ------------------------
-- A Studio intake link is a bearer credential: whoever holds it can upload to
-- that wardrobe and claim it. Until now it was valid until someone manually
-- archived the wardrobe, so a link forwarded, screenshotted or left in an
-- inbox stayed live indefinitely.
--
-- The owner's call (2026-09-20): **one week**. The upload cap stays
-- deliberately high until there are real users to size it against, and is
-- enforced in application code rather than here so it can be tuned without a
-- migration.
--
-- The grace period, and why
-- ------------------------
-- Both live wardrobes were created in January and February 2026, so dating the
-- expiry from `created_at` would expire every existing link the moment this
-- ran. They are almost certainly stale, but "almost certainly" is not a good
-- enough reason to break a link someone might be holding. Existing tokens are
-- therefore given a fresh week from the time of this migration; after that the
-- normal seven-day rule applies to every token issued or rotated.
--
-- Null means "never expires" and is accepted by the application, so a row that
-- somehow misses the backfill fails open rather than locking a client out.
-- Every code path that issues or rotates a token sets it explicitly.
--
-- Safety: additive. One nullable column and a backfill of 2 rows.
--
-- Rollback: ALTER TABLE public.wardrobes DROP COLUMN upload_token_expires_at;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.wardrobes
    ADD COLUMN IF NOT EXISTS upload_token_expires_at timestamptz;

COMMENT ON COLUMN public.wardrobes.upload_token_expires_at IS
    'When the current upload_token stops working. Set to now() + 7 days whenever a token is issued or rotated. NULL means no expiry, which only pre-migration-16 rows should ever be.';

-- Grace period for links that already exist, rather than expiring them
-- retroactively.
UPDATE public.wardrobes
SET upload_token_expires_at = now() + interval '7 days'
WHERE upload_token IS NOT NULL
  AND upload_token_expires_at IS NULL;

COMMIT;
