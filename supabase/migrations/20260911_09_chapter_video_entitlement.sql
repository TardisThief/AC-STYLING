-- Chapter video IDs become entitlement-gated; the rest of the row stays public.
--
-- The sales page at /vault must read the catalog as an anonymous visitor:
-- titles, subtitles, descriptions, thumbnails, module order. The policy that
-- allows that today is "Anyone can view chapters" USING (true), which covers
-- the WHOLE row — including video_id and video_id_es. Any anonymous client can
-- therefore enumerate the Vimeo IDs of paid content with a single REST call.
--
-- Domain-restricted Vimeo playback (being configured separately) is the real
-- control; this is the other half. A video ID is a product key and should not
-- be readable by someone who has not bought the product.
--
-- Technique mirrors migration 02 (partner_brands.internal_notes) and migration
-- 08 (wardrobe_items.internal_note): keep the row policies, drop the
-- table-level SELECT, and re-grant every column EXCEPT the two video columns.
-- Postgres has no "SELECT minus one column".
--
-- Column privileges are not role-aware beyond the Postgres role: `authenticated`
-- covers entitled buyers and non-buyers alike, so this hides the column from
-- every browser client, including a paying member's. Entitled playback is
-- served by getChapterVideo() (app/actions/vault/chapter-video.ts), which calls
-- the existing check_access() RPC and then reads the column with the service
-- role.
--
-- ORDER MATTERS — ship the coordinated code BEFORE applying this migration.
-- Eight call sites currently run select('*') on chapters and would start
-- failing with "permission denied for column video_id". They are replaced by
-- the explicit CHAPTER_CATALOG_COLUMNS list in app/lib/chapter-columns.ts.

REVOKE SELECT ON public.chapters FROM anon, authenticated;

-- Every column except video_id / video_id_es.
GRANT SELECT (
  id,
  slug,
  title,
  subtitle,
  description,
  order_index,
  category,
  thumbnail_url,
  lab_questions,
  takeaways,
  resource_urls,
  masterclass_id,
  is_standalone,
  stripe_product_id,
  price_id,
  title_es,
  subtitle_es,
  description_es,
  takeaways_es,
  is_published,
  available_at,
  created_at,
  updated_at
) ON public.chapters TO anon, authenticated;

-- video_id and video_id_es are intentionally NOT granted. Selecting either from
-- a browser client now errors with "permission denied for column".
--
-- NOTE: this migration assumes 20260911_10_catalog_publication.sql has already
-- added is_published and available_at. Apply 10 before 09, or drop those two
-- names from the grant list above.
--
-- STILL PUBLIC, deliberately out of scope but worth a decision:
--   * lab_questions  — the Essence Lab quiz content, authored paid IP.
--   * resource_urls  — downloadable asset links for paying members.
-- Both are anonymously readable today and both are arguably the same leak as
-- video_id. Left untouched here because the brief scoped this change to video
-- IDs; recommend a follow-up once the lead-magnet question is settled, since
-- the quiz may deliberately become public.

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
-- REVOKE SELECT ON public.chapters FROM anon, authenticated;
-- GRANT SELECT ON public.chapters TO anon, authenticated;
