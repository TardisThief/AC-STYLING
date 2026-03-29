"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { claimWardrobe } from "@/app/actions/wardrobes";
import { cookies } from "next/headers";

export async function processOnboarding() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const cookieStore = await cookies();
    let claimedWardrobeId: string | null = null;
    let profilesLinked = false;

    // 1. PROFILE LINKING LOGIC
    const intakeToken = cookieStore.get('intake_token')?.value;

    if (intakeToken) {
        const adminSupabase = createAdminClient();
        console.log('[Onboarding] Found intake token:', intakeToken);

        const { data: pendingProfile } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('intake_token', intakeToken)
            .single();

        if (pendingProfile && pendingProfile.id !== user.id) {
            console.log('[Onboarding] Merging profile:', pendingProfile.id, '->', user.id);

            // Transfer Profile Data
            await adminSupabase.from('profiles').update({
                full_name: pendingProfile.full_name,
                is_guest: false,
                converted_at: new Date().toISOString(),
                active_studio_client: true,
                studio_permissions: pendingProfile.studio_permissions || { lookbook: true, wardrobe: true }
            }).eq('id', user.id);

            // Handle Wardrobes
            const { data: guestWardrobe } = await adminSupabase.from('wardrobes').select('id').eq('owner_id', pendingProfile.id).maybeSingle();
            let targetWardrobeId = null;

            if (guestWardrobe) {
                await adminSupabase.from('wardrobes').update({ owner_id: user.id }).eq('id', guestWardrobe.id);
                targetWardrobeId = guestWardrobe.id;
            } else {
                // Ensure auth user has a wardrobe
                const { data: newWardrobe } = await adminSupabase.from('wardrobes').insert({
                    owner_id: user.id,
                    title: `${pendingProfile.full_name || 'My'} Wardrobe`,
                    status: 'active'
                }).select('id').single();
                if (newWardrobe) targetWardrobeId = newWardrobe.id;
            }

            // Transfer Items
            if (targetWardrobeId) {
                await adminSupabase.from('wardrobe_items')
                    .update({ user_id: user.id, wardrobe_id: targetWardrobeId })
                    .eq('user_id', pendingProfile.id);
            } else {
                await adminSupabase.from('wardrobe_items').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
            }

            // Transfer Assets
            await adminSupabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
            await adminSupabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', pendingProfile.id);

            // Cleanup
            await adminSupabase.from('profiles').delete().eq('id', pendingProfile.id);
            cookieStore.delete('intake_token');
            profilesLinked = true;
        }
    }

    // 2. WARDROBE CLAIM LOGIC
    const wardrobeToken = cookieStore.get('wardrobe_claim_token')?.value;
    if (wardrobeToken) {
        console.log('[Onboarding] Claiming wardrobe:', wardrobeToken);
        const claimResult = await claimWardrobe(wardrobeToken);
        if (claimResult.success) {
            claimedWardrobeId = claimResult.wardrobeId || null;
            cookieStore.delete('wardrobe_claim_token');
        }
    }

    return {
        success: true,
        linked: profilesLinked,
        claimedWardrobeId
    };
}
