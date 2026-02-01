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
            const intakeToken = cookieStore.get('intake_token')?.value;

            if (intakeToken) {
                // Use Admin Client to bypass RLS for profile linking and transfer
                // (User cannot update another profile's data or claim ownership without RLS policies)
                const { createAdminClient } = await import('@/utils/supabase/admin');
                const adminSupabase = createAdminClient();

                const { data: pendingProfile } = await adminSupabase
                    .from('profiles')
                    .select('*')
                    .eq('intake_token', intakeToken)
                    .single();

                if (pendingProfile && pendingProfile.id !== user.id) {
                    await adminSupabase.from('profiles').update({ full_name: pendingProfile.full_name, is_guest: false, converted_at: new Date().toISOString() }).eq('id', user.id);
                    // Transfer Wardrobe Ownership
                    await adminSupabase.from('wardrobes').update({ owner_id: user.id }).eq('owner_id', pendingProfile.id);
                    // Transfer Items
                    await adminSupabase.from('wardrobe_items').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await adminSupabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await adminSupabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await adminSupabase.from('profiles').delete().eq('id', pendingProfile.id);
                    cookieStore.delete('intake_token');
                }
            }

            // WARDROBE CLAIM LOGIC
            const wardrobeClaimToken = cookieStore.get('wardrobe_claim_token')?.value;
            if (wardrobeClaimToken) {
                await claimWardrobe(wardrobeClaimToken);
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
