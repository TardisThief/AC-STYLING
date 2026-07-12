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
