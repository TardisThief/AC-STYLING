'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signUpSeamless(formData: FormData, redirectPath: string = '/vault', token?: string) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;

    const supabase = await createClient();

    // 1. Sign Up
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    if (data.session) {
        // Success - Link Token if provided
        if (token) {
            await linkIntakeProfile(token);
        }
        redirect(redirectPath);
    } else if (data.user && !data.session) {
        return { error: "Please verify your email to continue." };
    }

    return { error: "Unknown error occurred." };
}

// ... convertGuestAccount ...

export async function linkIntakeProfile(token: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    // 1. Find the "Invite Profile"
    const { data: inviteProfile, error: inviteError } = await supabase
        .from('profiles')
        .select('*')
        .eq('intake_token', token)
        .neq('id', user.id)
        .single();

    if (!inviteProfile) {
        return { message: "Token already processed or invalid." };
    }

    // 2. Transfer Data (Wardrobe, Tailor Cards, Lookbooks)
    // Update IDs to the new user
    await supabase.from('wardrobe_items').update({ user_id: user.id }).eq('user_id', inviteProfile.id);
    await supabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', inviteProfile.id);
    await supabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', inviteProfile.id);

    // 3. Update Current Profile Permissions (if the invite had special ones)
    // We merge them rather than overwrite blindly? 
    // Usually invites grant Studio Access.
    await supabase
        .from('profiles')
        .update({
            // active_studio_client: true, // Only if invite implies it? Yes.
            // studio_permissions: inviteProfile.studio_permissions,
            // Actually, handle_new_purchase sets this. 
            // But invites are usually for Studio Clients.
            active_studio_client: true, // Force enable studio for invited users
            studio_permissions: inviteProfile.studio_permissions || { lookbook: true, wardrobe: true },
            intake_token: token
        })
        .eq('id', user.id);

    // 4. Delete the Invite Profile (Cleanup)
    const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', inviteProfile.id);

    if (deleteError) {
        console.error("Cleanup Error:", deleteError);
        // Fallback: Archive it if delete fails
        await supabase.from('profiles').update({ status: 'archived' }).eq('id', inviteProfile.id);
    }

    return { success: true };
}
