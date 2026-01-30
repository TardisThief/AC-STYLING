import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import IntakeLanding from "@/components/studio/IntakeLanding";

export default async function IntakePage({
    params
}: {
    params: Promise<{ locale: string, token: string }>
}) {
    const { locale, token } = await params;
    const t = await getTranslations({ locale, namespace: 'Studio' });
    const supabase = await createClient();

    // 1. Validate Token
    // We expect the token to be a valid intake_token in the profiles table
    // (In a real flow, Alejandra would have pre-created this guest/link)
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('intake_token', token)
        .single();

    // If no profile found with this token, we might show a "Invalid Link" state
    // For this implementation, we'll assume the link is valid if it exists, 
    // or we can allow "New" intakes if the token is a specific "Generic" one.

    // 2. Check if already converted
    // 2. Check if already converted
    // However, if the current user IS the owner (they just converted), allow them to proceed to upload.
    const { data: { user } } = await supabase.auth.getUser();

    if (profile?.converted_at) {
        // If converted AND the logged-in user is NOT the owner, it's a dead link.
        // If it IS the owner, they probably just signed up and want to upload.
        if (!user || user.id !== profile.id) {
            redirect('/login');
        }
    }

    // 3. User is already fetched above
    // const { data: { user } } = await supabase.auth.getUser();

    // 4. Auto-Link Profile if needed
    // If the user is logged in, but the token belongs to a DIFFERENT active profile (the invite), merge them.
    if (user && profile && profile.id !== user.id && profile.status === 'active') {
        const { linkIntakeProfile } = await import("@/app/actions/auth");
        await linkIntakeProfile(token);
        // We don't need to redirect, just continue. The UI will show the Uploader for the AUTH user.
    }

    // 5. Check if authenticated user matches profile (optional, or we link them now?)
    // For now, prompt the user to sign up/in if not authenticated.
    // If authenticated, we show the uploader.

    return (
        <main className="min-h-screen bg-ac-sand flex flex-col items-center justify-center p-6 bg-gradient-to-b from-ac-sand to-[#efe9e1]">
            <div className="absolute inset-0 bg-ac-sand/50 backdrop-blur-3xl -z-10" />

            <IntakeLanding
                token={token}
                clientName={profile?.full_name || "Style Icon"}
                locale={locale}
                user={(user && !user.is_anonymous) ? user : null} // Only real users
            />
        </main>
    );
}
