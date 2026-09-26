/**
 * The chapter columns a browser client may read.
 *
 * Migration 09 revokes table-level SELECT on `chapters` from `anon` and
 * `authenticated` and re-grants every column except `video_id` and
 * `video_id_es`. Any `select('*')` against that table from a cookie-aware or
 * anon client therefore fails with "permission denied for column video_id".
 *
 * This is the single list those call sites use. Column privileges are not
 * role-aware beyond the Postgres role — an admin is `authenticated` too — so
 * reading a video id anywhere requires the service role. Playback goes through
 * `getChapterVideo()` in app/actions/vault/chapter-video.ts; the admin console
 * reads through `getChaptersAdmin()`.
 *
 * Mirrors app/lib/wardrobe-columns.ts, which exists for the same reason after
 * migration 08.
 *
 * `lab_questions` and `resource_urls` are not here either: they are paid
 * content, revoked from browser roles by migration 30. Read them with
 * app/lib/paid-content.ts, after checkAccess().
 */

// One unbroken literal, matching CLIENT_ITEM_COLUMNS in wardrobe-columns.ts.
// Supabase infers the row shape by parsing this string at type-check time;
// an array join or a `+` concatenation widens to `string`, the result
// collapses to GenericStringError, and every property access downstream
// stops compiling.
export const CHAPTER_CATALOG_COLUMNS =
    'id, slug, title, subtitle, description, order_index, category, thumbnail_url, takeaways, masterclass_id, is_standalone, stripe_product_id, price_id, title_es, subtitle_es, description_es, takeaways_es, is_published, available_at, created_at, updated_at';

/**
 * The masterclass columns a browser client may read: every one except
 * `resource_urls`, which migration 30 made paid content (read it with
 * app/lib/paid-content.ts after checkAccess()). masterclasses moved to
 * column-level SELECT in that migration, so `select('*')` from a cookie-aware
 * or anon client fails with "permission denied" — use this instead.
 */
export const MASTERCLASS_CATALOG_COLUMNS =
    'id, title, subtitle, description, thumbnail_url, order_index, created_at, updated_at, stripe_product_id, price_id, title_es, subtitle_es, description_es, takeaways_es, video_url, is_published, available_at, price_display, runtime_minutes';
