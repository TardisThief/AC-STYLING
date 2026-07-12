import { createVaultUploadUrl } from '@/app/actions/admin/upload-file';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Upload a file to the vault-assets bucket from an admin form, surfacing every
 * failure mode as a toast.
 *
 * The file goes directly from the browser to Supabase Storage via a signed
 * upload URL — it must not pass through a server action, whose request body
 * Vercel caps at 4.5 MB in production (see createVaultUploadUrl).
 */
export async function uploadAssetWithToast(file: File, successMessage: string): Promise<string | null> {
    if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" is too large — uploads are limited to 15 MB.`);
        return null;
    }

    try {
        const authorized = await createVaultUploadUrl(file.name);
        if (!authorized.success) {
            toast.error(authorized.error || 'Upload failed. Check storage permissions.');
            return null;
        }

        const storage = createClient().storage.from('vault-assets');
        const { error } = await storage.uploadToSignedUrl(authorized.path, authorized.token, file);
        if (error) {
            toast.error(error.message || 'Upload failed. Check storage permissions.');
            return null;
        }

        const { data: { publicUrl } } = storage.getPublicUrl(authorized.path);
        toast.success(successMessage);
        return publicUrl;
    } catch {
        toast.error('Upload failed — please check your connection and try again.');
        return null;
    }
}
