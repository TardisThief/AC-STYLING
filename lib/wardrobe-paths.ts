/**
 * Folder convention for the `studio-wardrobe` bucket (see spec
 * 2026-07-11-wardrobe-storage-normalization-design.md):
 *  - owned content lives under `<ownerId>/…` so storage RLS can check
 *    foldername[1] = auth.uid()
 *  - ownerless content (guest intake, unassigned wardrobes) lives under
 *    `wardrobe/<id>/…`, readable by the eventual owner via a wardrobes
 *    subquery in the policy.
 */
export function wardrobeStorageFolder(ownerId: string | null, wardrobeId: string): string {
    return ownerId ? ownerId : `wardrobe/${wardrobeId}`;
}

export function wardrobeUploadPath(
    ownerId: string | null,
    wardrobeId: string,
    fileName: string,
    now: number = Date.now(),
): string {
    const safeName = fileName
        .replace(/\.\./g, '')
        .replace(/[/\\]/g, '_')
        .slice(0, 100) || 'upload';
    return `${wardrobeStorageFolder(ownerId, wardrobeId)}/${now}-${safeName}`;
}

/**
 * Is this storage path one that an upload for this wardrobe could have used?
 *
 * Accepts the guest-intake folder `wardrobe/<id>/…` that `getSignedUploadUrl`
 * issues, and the owner folder `<ownerId>/…` that owned wardrobes use per
 * lib/wardrobe-paths.ts. Everything else is refused, including traversal and
 * any path belonging to a different wardrobe or user.
 */
export function isPathWithinWardrobe(
    filePath: string,
    wardrobeId: string,
    ownerId: string | null
): boolean {
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) return false;

    const allowed = [`wardrobe/${wardrobeId}/`];
    if (ownerId) allowed.push(`${ownerId}/`);

    // A trailing segment is required: the prefix alone is a folder, not a file.
    return allowed.some((prefix) => filePath.startsWith(prefix) && filePath.length > prefix.length);
}
