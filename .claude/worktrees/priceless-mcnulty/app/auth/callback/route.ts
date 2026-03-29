import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { claimWardrobe } from '@/app/actions/wardrobes'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.exchangeCodeForSession(code)

        if (!authError && user) {
            const cookieStore = await cookies();

            // Resolve redirect URL: URL param > cookie > default
            let next = searchParams.get('next');
            if (!next) {
                const nextCookie = cookieStore.get('auth_next_url')?.value;
                if (nextCookie) {
                    next = nextCookie;
                    cookieStore.delete('auth_next_url');
                }
            }
            next = next || '/en/vault';

            // PROFILE LINKING LOGIC
            // Try cookie first, then URL param (more robust)
            let intakeToken = cookieStore.get('intake_token')?.value;
            if (!intakeToken) {
                intakeToken = searchParams.get('intake_token') || undefined;
            }

            if (intakeToken) {
                // Use Admin Client to bypass RLS for profile linking and transfer
                // (User cannot update another profile's data or claim ownership without RLS policies)
                const { createAdminClient } = await import('@/utils/supabase/admin');
                const adminSupabase = createAdminClient();

                const { data: pendingProfile } = await adminSupabase
                    .from('profiles')
                    .select('*')
                    .eq('intake_token', intakeToken)
                    .single(); // Use admin to find it even if RLS hides it

                if (pendingProfile && pendingProfile.id !== user.id) {
                    await adminSupabase.from('profiles').update({
                        full_name: pendingProfile.full_name,
                        is_guest: true, // Correctly mark as guest since they are claiming an invite
                        converted_at: new Date().toISOString(),
                        active_studio_client: true, // Enable Studio Access
                        studio_permissions: pendingProfile.studio_permissions || { lookbook: true, wardrobe: true }
                    }).eq('id', user.id);

                    // Wardrobe Logic: Ensure user has a wardrobe and items are linked
                    let targetWardrobeId: string | null = null;

                    // 1. Check if guest already has a wardrobe
                    const { data: guestWardrobe } = await adminSupabase.from('wardrobes').select('id').eq('owner_id', pendingProfile.id).maybeSingle();
                    if (guestWardrobe) {
                        await adminSupabase.from('wardrobes').update({ owner_id: user.id }).eq('id', guestWardrobe.id);
                        targetWardrobeId = guestWardrobe.id;
                    } else {
                        // 2. Create new wardrobe if none exists
                        const { data: newWardrobe } = await adminSupabase.from('wardrobes').insert({
                            owner_id: user.id,
                            title: `${pendingProfile.full_name || 'My'} Wardrobe`,
                            status: 'active'
                        }).select('id').single();
                        if (newWardrobe) targetWardrobeId = newWardrobe.id;
                    }

                    // 3. Transfer Items & Link to Wardrobe
                    if (targetWardrobeId) {
                        // Update items to belong to new user AND new wardrobe (if missing)
                        await adminSupabase.from('wardrobe_items')
                            .update({ user_id: user.id, wardrobe_id: targetWardrobeId })
                            .eq('user_id', pendingProfile.id);
                    } else {
                        // Fallback just transfer ownership (shouldn't happen if insert succeeds)
                        await adminSupabase.from('wardrobe_items').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    }

                    // Transfer other assets
                    await adminSupabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await adminSupabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await adminSupabase.from('profiles').delete().eq('id', pendingProfile.id);
                    cookieStore.delete('intake_token');
                }
            }

            // WARDROBE CLAIM LOGIC - check cookie first, then URL param (for email magic links)
            let wardrobeClaimToken = cookieStore.get('wardrobe_claim_token')?.value;
            if (!wardrobeClaimToken) {
                wardrobeClaimToken = searchParams.get('wardrobe_claim') || undefined;
            }
            console.log('[AuthCallback] Wardrobe claim token:', wardrobeClaimToken ? 'FOUND' : 'NOT FOUND');
            if (wardrobeClaimToken) {
                console.log('[AuthCallback] Attempting to claim wardrobe with token:', wardrobeClaimToken.substring(0, 8) + '...');
                const claimResult = await claimWardrobe(wardrobeClaimToken);
                console.log('[AuthCallback] Claim result:', claimResult);
                cookieStore.delete('wardrobe_claim_token');
            }

            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'

            // Determine the base URL for the redirect
            let baseUrl = origin; // Default to the request origin

            if (process.env.NEXT_PUBLIC_SITE_URL) {
                baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
            } else if (!isLocalEnv && forwardedHost) {
                baseUrl = `https://${forwardedHost}`;
            } else if (!isLocalEnv && request.headers.get('host')) {
                baseUrl = `https://${request.headers.get('host')}`;
            }

            // Ensure baseUrl doesn't end with a slash if next starts with one
            if (baseUrl.endsWith('/') && next.startsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }

            return NextResponse.redirect(`${baseUrl}${next}`)
        } else {
            console.error('[AuthCallback] Exchange Error:', authError);
            // Default to 'en' locale on auth error
            return NextResponse.redirect(`${origin}/en/login?error=auth_code_error&details=${encodeURIComponent(authError?.message || 'Unknown error')}`);
        }
    }

    return NextResponse.redirect(`${origin}/en/login?error=no_code`)
}
