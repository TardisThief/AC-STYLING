-- Publication gate + the catalog metadata the sales page renders.
--
-- The public Vault page generates its catalog from this table. Today every row
-- is live to anyone who queries it and there is no publish flag, so a generated
-- catalog would happily advertise "The AC Method" and "Body Shape" — rows whose
-- video_url is literally `vimeo.com/pending_m1`.
--
-- Rather than hard-code which courses are real, the catalog reads is_published.
-- Published rows render fully. Unpublished rows render only when the reveal
-- flag is on, and then as "in production, included in Full Access" cards. A
-- date appears ONLY when available_at is set; when it is null the card says the
-- course is in production and nothing more. No date is ever inferred.
--
-- Defaults to false so a newly seeded row is never accidentally advertised.

-- --- masterclasses ---------------------------------------------------------
ALTER TABLE public.masterclasses
  ADD COLUMN IF NOT EXISTS is_published  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_at  timestamptz,
  -- Mirrors offers.price_display / services.price_display: a human-readable
  -- string authored alongside the Stripe price, so a statically prerendered
  -- card never has to call the Stripe API to show a number.
  ADD COLUMN IF NOT EXISTS price_display text;

COMMENT ON COLUMN public.masterclasses.is_published IS
  'Renders fully in the public catalog. False = in production; shown only behind the reveal flag.';
COMMENT ON COLUMN public.masterclasses.available_at IS
  'Real, committed availability date. NULL means "in production" with no date claimed. Never infer one.';

-- --- chapters --------------------------------------------------------------
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS is_published    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_at    timestamptz,
  -- A stored column beats a live Vimeo fetch: the sales page is statically
  -- prerendered, so a per-request API call would either break static rendering
  -- or add a build-time dependency on Vimeo being up. NULL means the card omits
  -- runtime rather than guessing it.
  ADD COLUMN IF NOT EXISTS runtime_seconds integer
    CONSTRAINT chapters_runtime_seconds_positive CHECK (runtime_seconds IS NULL OR runtime_seconds > 0);

COMMENT ON COLUMN public.chapters.runtime_seconds IS
  'Module runtime. NULL = unknown; the card omits runtime rather than showing a guess.';

-- --- backfill --------------------------------------------------------------
-- Colorimetry is the one course with a real video, a real thumbnail and a live
-- Stripe product, so it and its five modules are the published set on day one.
-- Everything else stays false until its content is real.
--
-- NOTE: Colorimetry's per-module video_id values are still 'TODO_FILL_IN'. The
-- page ships noindex/unlisted until those are real; publishing here makes the
-- catalog renderable, not the course indexable.
UPDATE public.masterclasses SET is_published = true WHERE title = 'Colorimetry';
UPDATE public.chapters SET is_published = true
  WHERE masterclass_id = (SELECT id FROM public.masterclasses WHERE title = 'Colorimetry');

-- Partial indexes: the public catalog only ever reads published rows.
CREATE INDEX IF NOT EXISTS masterclasses_published_idx
  ON public.masterclasses (order_index) WHERE is_published;
CREATE INDEX IF NOT EXISTS chapters_published_idx
  ON public.chapters (masterclass_id, order_index) WHERE is_published;

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.chapters_published_idx;
-- DROP INDEX IF EXISTS public.masterclasses_published_idx;
-- ALTER TABLE public.chapters
--   DROP COLUMN IF EXISTS runtime_seconds,
--   DROP COLUMN IF EXISTS available_at,
--   DROP COLUMN IF EXISTS is_published;
-- ALTER TABLE public.masterclasses
--   DROP COLUMN IF EXISTS price_display,
--   DROP COLUMN IF EXISTS available_at,
--   DROP COLUMN IF EXISTS is_published;
