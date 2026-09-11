-- Record WHAT was bought and WHEN for offer purchases: the founding-cohort record.
--
-- Masterclass and chapter purchases write a row to user_access_grants. Offer
-- purchases do not — grantAccessForProduct() flips profiles.has_full_unlock or
-- profiles.has_course_pass and writes nothing else. A boolean carries no record
-- of which offer was bought or when, so once the founding window closes there
-- is no way to identify the founding members: not for pricing, not for perks,
-- not for support. That information is unrecoverable retroactively, which is
-- why this ships before the first real sale.
--
-- Access terms are NOT versioned here. Lifetime access is unconditional for
-- this launch and does not change, so there is no terms snapshot to store —
-- this is a cohort record, not an entitlement contract.
--
-- Amount and currency already live in `purchases` (amount_paid, currency,
-- created_at), keyed by user_id, so they are deliberately not duplicated.

ALTER TABLE public.user_access_grants
  ADD COLUMN IF NOT EXISTS offer_slug text;

COMMENT ON COLUMN public.user_access_grants.offer_slug IS
  'offers.slug for an offer purchase (full_access / course_pass). Founding-cohort record; granted_at is the purchase time.';

-- The existing constraint requires a masterclass or chapter target, which an
-- offer-wide grant has neither of. Widen it to "exactly one target of three".
ALTER TABLE public.user_access_grants DROP CONSTRAINT IF EXISTS valid_grant_target;
ALTER TABLE public.user_access_grants
  ADD CONSTRAINT valid_grant_target CHECK (
    (masterclass_id IS NOT NULL)::int
  + (chapter_id     IS NOT NULL)::int
  + (offer_slug     IS NOT NULL)::int = 1
  );

-- One grant per user per offer; a replayed webhook must not create a second
-- founding record. (The webhook's event-level idempotency gate is the first
-- line of defence; this is the constraint that makes it true at rest.)
CREATE UNIQUE INDEX IF NOT EXISTS user_access_grants_user_offer_uniq
  ON public.user_access_grants (user_id, offer_slug) WHERE offer_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_access_grants_offer_slug_idx
  ON public.user_access_grants (offer_slug, granted_at) WHERE offer_slug IS NOT NULL;

-- NO BACKFILL. Two profiles currently carry has_full_unlock; both are admin or
-- test accounts predating any real sale, and inventing a granted_at for them
-- would put fictional members in the founding cohort. If a genuine pre-launch
-- buyer needs to be recorded, insert the row by hand with the real date from
-- `purchases`.

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.user_access_grants_offer_slug_idx;
-- DROP INDEX IF EXISTS public.user_access_grants_user_offer_uniq;
-- ALTER TABLE public.user_access_grants DROP CONSTRAINT IF EXISTS valid_grant_target;
-- ALTER TABLE public.user_access_grants
--   ADD CONSTRAINT valid_grant_target CHECK (masterclass_id IS NOT NULL OR chapter_id IS NOT NULL);
-- -- Offer-only rows violate the restored constraint; delete them first:
-- --   DELETE FROM public.user_access_grants WHERE offer_slug IS NOT NULL;
-- ALTER TABLE public.user_access_grants DROP COLUMN IF EXISTS offer_slug;
