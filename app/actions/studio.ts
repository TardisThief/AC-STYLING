"use server";

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ... extractUrlMetadata remains unchanged ...

export async function extractUrlMetadata(url: string) {
    if (!url) return null;

    // Helper to clean text
    const clean = (str: string | undefined | null) => str ? str.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ') : "";

    try {
        const browser = await puppeteer.launch({
            headless: true, // "new" is deprecated, true is current standard
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Mock a real user agent - REMOVED: Using default browser UA is more consistent for anti-bot
        // await page.setUserAgent('Mozilla/5.0 ...');

        // Go to URL and wait for meaningful content
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Extract metadata using page evaluation (runs in browser context)
        const metadata = await page.evaluate(() => {
            const getMeta = (props: string[]) => {
                for (const prop of props) {
                    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
                    if (el) return el.getAttribute('content');
                }
                return null;
            };

            const title =
                getMeta(['og:title', 'twitter:title', 'title']) ||
                document.title ||
                document.querySelector('h1')?.innerText;

            // Strategy: Gather ALL valid images
            const images = new Set<string>();

            // 1. OG Image (High priority default)
            const ogImage = getMeta(['og:image', 'twitter:image', 'image']);
            if (ogImage) images.add(ogImage);

            // 2. Schema.org (JSON-LD) - Gold standard for e-commerce
            try {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                scripts.forEach(script => {
                    try {
                        const json = JSON.parse(script.innerHTML);
                        // Access JSON-LD nodes
                        const items = Array.isArray(json) ? json : [json];
                        items.forEach(item => {
                            if (item.image) {
                                if (Array.isArray(item.image)) {
                                    item.image.forEach((img: string) => images.add(img));
                                } else if (typeof item.image === 'string') {
                                    images.add(item.image);
                                } else if (item.image.url) {
                                    images.add(item.image.url);
                                }
                            }
                        });
                    } catch (e) { }
                });
            } catch (e) { }

            // 3. Fallbacks
            const linkImg = document.querySelector<HTMLElement>('link[rel="image_src"]')?.getAttribute('href');
            if (linkImg) images.add(linkImg);

            // Return array
            return {
                title,
                images: Array.from(images),
                description: getMeta(['og:description', 'twitter:description', 'description']),
                siteName: getMeta(['og:site_name', 'site_name'])
            };
        });

        await browser.close();

        // Clean and validate
        return {
            title: clean(metadata.title),
            images: metadata.images, // Pass full array
            image: metadata.images[0] || "", // Default to first
            description: clean(metadata.description),
            siteName: clean(metadata.siteName)
        };

    } catch (error) {
        console.error("Puppeteer Extraction Error:", error);
        return null;
    }
}

// ... updateProfileStatus remains unchanged ...

export async function updateProfileStatus(profileId: string, status: 'active' | 'archived') {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Check if Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ status })
            .eq('id', profileId);

        if (error) throw error;

        revalidatePath('/[locale]/vault/studio', 'page');
        return { success: true };
    } catch (err: any) {
        console.error("Update Status Error:", err);
        return { success: false, error: err.message };
    }
}

// ... permanentDeleteProfile remains unchanged ...
export async function permanentDeleteProfile(profileId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Check if Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        // FKs are ON DELETE CASCADE in studio_schema, so this should wipe assets/lookbooks too
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileId);

        if (error) throw error;

        revalidatePath('/[locale]/vault/studio', 'page');
        return { success: true };
    } catch (err: any) {
        console.error("Delete Profile Error:", err);
        return { success: false, error: err.message };
    }
}

// ... deleteWardrobeItem remains unchanged ...
export async function deleteWardrobeItem(itemId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // 2. Get Item to check ownership & image path
    const { data: item, error: fetchError } = await supabase
        .from('wardrobe_items')
        .select('user_id, image_url')
        .eq('id', itemId)
        .single();

    if (fetchError || !item) return { success: false, error: "Item not found" };

    // 3. Permission Check
    // Allow if Owner OR Admin
    let canDelete = item.user_id === user.id;

    if (!canDelete) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin') canDelete = true;
    }

    if (!canDelete) return { success: false, error: "Unauthorized" };

    try {
        // 4. Delete Database Record
        const { error: deleteError } = await supabase
            .from('wardrobe_items')
            .delete()
            .eq('id', itemId);

        if (deleteError) throw deleteError;

        // 5. Delete from Storage (Best Effort)
        // Extract path from public URL: .../studio-wardrobe/user_id/filename
        try {
            const url = new URL(item.image_url);
            const pathParts = url.pathname.split('/studio-wardrobe/');
            if (pathParts.length > 1) {
                const storagePath = pathParts[1]; // Should comprise "userId/filename" or similar
                // We decodeURI just in case spaces etc
                await supabase.storage.from('studio-wardrobe').remove([decodeURIComponent(storagePath)]);
            }
        } catch (storageErr) {
            console.warn("Failed to delete storage file (orphaned):", storageErr);
        }

        return { success: true };
    } catch (err: any) {
        console.error("Delete Item Error:", err);
        return { success: false, error: err.message };
    }
}

// --- NEW ACTIONS FOR STUDIO INBOX ---

export async function getStudioInboxItems() {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Auth Check (Admin Only)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    // 2. Fetch Inbox Items
    // Use select with join to get profile full_name
    const { data, error } = await supabase
        .from('wardrobe_items')
        .select(`
            *,
            profiles:user_id ( full_name )
        `)
        .eq('status', 'inbox') // TODO: Ensure you migrate existing items or handle NULL
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Fetch Inbox Error:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data };
}

export async function processWardrobeItem(
    itemId: string,
    status: 'keep' | 'donate' | 'repair' | 'inbox',
    metadata?: { tags?: string[], brand?: string, notes?: string }
) {
    const { createClient } = await import("@/utils/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

    // 2. Update
    const updates: any = { status };
    if (metadata?.tags) updates.tags = metadata.tags;
    if (metadata?.brand) updates.brand = metadata.brand;
    if (metadata?.notes) updates.notes = metadata.notes;

    const { error } = await supabase
        .from('wardrobe_items')
        .update(updates)
        .eq('id', itemId);

    if (error) {
        console.error("Update Item Error:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/[locale]/vault/admin', 'page');
    return { success: true };
}

export async function uploadRemoteImage(imageUrl: string, userId: string) {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // 2. Fetch the remote image
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Determine extension
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}-remote.${ext}`;
        const filePath = `${userId}/${fileName}`;

        // 3. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(filePath, buffer, {
                contentType,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl };

    } catch (error: any) {
        console.error("Remote Upload Error:", error);
        return { success: false, error: error.message || "Failed to upload remote image" };
    }
}

export async function uploadGuestWardrobeItem(formData: FormData, token: string) {
    // USE SERVICE ROLE TO BYPASS RLS FOR GUEST UPLOADS
    // Guests are "anon" so they can't insert into wardrobe_items for another user (even if it's an invite profile)
    // We validate the token (Business Logic) -> Then use Admin Privileges (Service Role) to execute.
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Validate Token & Find Invite Profile
    const { data: inviteProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('intake_token', token)
        .single();

    if (profileError || !inviteProfile) {
        return { success: false, error: "Invalid or expired intake token." };
    }

    try {
        const file = formData.get('file') as File;
        const clientNote = formData.get('note') as string;

        if (!file) throw new Error("No file provided");

        // 2. Upload to Storage (Using Invite Profile ID)
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${inviteProfile.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `wardrobe/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('studio-wardrobe')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('studio-wardrobe')
            .getPublicUrl(filePath);

        // 4. Insert into Database (Linked to Invite Profile)
        const { error: dbError } = await supabase
            .from('wardrobe_items')
            .insert({
                user_id: inviteProfile.id,
                image_url: publicUrl,
                client_note: clientNote || "",
                status: 'inbox' // Mark as inbox for admin review
            });

        if (dbError) throw dbError;

        return { success: true };

    } catch (error: any) {
        console.error("Guest Upload Error:", error);
        return { success: false, error: error.message || "Upload failed" };
    }
}
