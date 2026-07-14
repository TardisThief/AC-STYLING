import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helpers for displaying private `studio-wardrobe` images via short-lived signed
 * URLs. Once migration 03 makes the bucket private, `getPublicUrl` links stop
 * resolving; callers must render freshly-signed URLs instead.
 *
 * Signing happens with the caller's own (authenticated) Supabase client, which
 * storage RLS permits for the file owner or an admin. Only authenticated views
 * render wardrobe images (the guest intake flow is upload-only), so no
 * service-role path is needed.
 */

const BUCKET = 'studio-wardrobe';
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

/**
 * Derive the in-bucket storage path from a stored `image_url`, which may be a
 * full public URL (`…/studio-wardrobe/<path>`) or already a bare path.
 * Returns null for foreign/external URLs that we can't sign.
 */
export function deriveStoragePath(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;

    const marker = `/${BUCKET}/`;
    const idx = imageUrl.indexOf(marker);
    if (idx !== -1) {
        return decodeURIComponent(imageUrl.slice(idx + marker.length));
    }

    // Not a public URL for this bucket. If it's a bare relative path, use it;
    // otherwise it's an external URL we shouldn't try to sign.
    if (!/^https?:\/\//i.test(imageUrl)) {
        return imageUrl.replace(/^\/+/, '') || null;
    }
    return null;
}

type WithImage = { image_url?: string | null };

/**
 * Return a copy of `items` with each `image_url` swapped for a fresh signed URL.
 * Items whose path can't be derived (or that fail to sign) keep their original
 * value, so a private bucket degrades gracefully rather than throwing.
 */
export async function signWardrobeItems<T extends WithImage>(
    supabase: Pick<SupabaseClient, 'storage'>,
    items: T[],
    ttl: number = SIGNED_URL_TTL_SECONDS,
): Promise<T[]> {
    if (!items || items.length === 0) return items;

    const paths = items.map((item) => deriveStoragePath(item.image_url));
    const uniquePaths = [...new Set(paths.filter((p): p is string => p !== null))];
    if (uniquePaths.length === 0) return items;

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(uniquePaths, ttl);

    if (error || !data) return items;

    const signedByPath = new Map<string, string>();
    for (const row of data) {
        if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl);
    }

    return items.map((item, i) => {
        const path = paths[i];
        const signed = path ? signedByPath.get(path) : undefined;
        return signed ? { ...item, image_url: signed } : item;
    });
}
