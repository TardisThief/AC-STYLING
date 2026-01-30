import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { claimWardrobe } from '@/app/actions/wardrobes'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/en/vault'

    if (code) {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.exchangeCodeForSession(code)

        if (!authError && user) {
            // ... (Profile linking logic remains same - assuming it's above or I should include it?) 
            // WAIT, replace_file_content replaces the WHOLE block. Be careful.
            // I will target the error block primarily or use a broader replacement if I can't match easily.
            // Let's stick to the failing part to minimize diff size risk, merging back.

            // PROFILE LINKING LOGIC
            const cookieStore = await cookies();
            const intakeToken = cookieStore.get('intake_token')?.value;

            if (intakeToken) {
                const { data: pendingProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('intake_token', intakeToken)
                    .single();

                if (pendingProfile && pendingProfile.id !== user.id) {
                    await supabase.from('profiles').update({ full_name: pendingProfile.full_name, is_guest: false, converted_at: new Date().toISOString() }).eq('id', user.id);
                    await supabase.from('wardrobe_items').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await supabase.from('tailor_cards').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await supabase.from('lookbooks').update({ user_id: user.id }).eq('user_id', pendingProfile.id);
                    await supabase.from('profiles').delete().eq('id', pendingProfile.id);
                    cookieStore.delete('intake_token');
                }
            }

            // WARDROBE CLAIM LOGIC
            const wardrobeClaimToken = cookieStore.get('wardrobe_claim_token')?.value;
            if (wardrobeClaimToken) {
                await claimWardrobe(wardrobeClaimToken);
                cookieStore.delete('wardrobe_claim_token');
            }

            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        } else {
            console.error('[AuthCallback] Exchange Error:', authError);
            const locale = next.split('/')[1] || 'en'; // Extract 'en' from '/en/vault'
            return NextResponse.redirect(`${origin}/${locale}/login?error=auth_code_error&details=${encodeURIComponent(authError?.message || 'Unknown error')}`);
        }
    }

    return NextResponse.redirect(`${origin}/en/login?error=no_code`)
}
