/**
 * Columns of `wardrobe_items` that a client's own browser client may read.
 *
 * `internal_note` is deliberately absent. Migration
 * `20260715_08_private_internal_note.sql` revokes column-level access to it
 * from `anon`/`authenticated`, so a browser `select('*')` would fail outright —
 * clients must name the columns they are allowed to see. Ale reads the private
 * note through `getAdminWardrobeItems` (service role) instead.
 *
 * Lives here rather than in `app/actions/wardrobes.ts` because a "use server"
 * module may only export async functions.
 */
export const CLIENT_ITEM_COLUMNS =
    'id, user_id, wardrobe_id, image_url, category, client_note, notes, brand, status, tags, product_link_id, is_general_library, created_at, updated_at';
