"use server";

import { requireAdmin } from '@/app/lib/auth-guards';

/**
 * Authorize a direct browser → Supabase Storage upload to `vault-assets`.
 *
 * File bytes must NOT travel through a server action: Vercel caps request
 * bodies at 4.5 MB regardless of `serverActions.bodySizeLimit`, so routing the
 * file here fails in production for anything larger. Instead this action only
 * verifies the caller is an admin and mints a signed upload URL; the client
 * then PUTs the file straight to storage (app/lib/upload-client.ts).
 */
export async function createVaultUploadUrl(fileName: string) {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    // Keep the object key flat inside the bucket: no path separators, no
    // traversal sequences, and a sane length cap.
    const safeName = String(fileName)
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .slice(0, 100) || 'upload';
    const path = `${Date.now()}-${safeName}`;

    const { data, error } = await auth.supabase.storage
        .from('vault-assets')
        .createSignedUploadUrl(path);

    if (error || !data) {
        return { success: false as const, error: error?.message || 'Could not authorize upload' };
    }

    return { success: true as const, path: data.path, token: data.token };
}
