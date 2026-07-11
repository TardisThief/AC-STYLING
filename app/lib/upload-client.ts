import { uploadFile } from '@/app/actions/admin/upload-file';
import { toast } from 'sonner';

// Must stay at or below experimental.serverActions.bodySizeLimit (next.config.mjs).
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Upload a file to the vault-assets bucket from an admin form, surfacing every
 * failure mode as a toast. A server action that exceeds the body size limit
 * REJECTS (it never returns `{ success: false }`), so without the try/catch the
 * admin dropzones failed silently — the original "upload does nothing" bug.
 */
export async function uploadAssetWithToast(file: File, successMessage: string): Promise<string | null> {
    if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" is too large — uploads are limited to 15 MB.`);
        return null;
    }

    try {
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadFile(fd);

        if (!result.success || !result.url) {
            toast.error(result.error || 'Upload failed. Check storage permissions.');
            return null;
        }

        toast.success(successMessage);
        return result.url;
    } catch {
        toast.error('Upload failed — the file may be too large or the connection dropped. Please try again.');
        return null;
    }
}
