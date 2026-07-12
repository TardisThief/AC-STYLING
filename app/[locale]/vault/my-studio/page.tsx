import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ClientStudioDashboard from "@/components/studio/ClientStudioDashboard";
import { getMyWardrobe } from "@/app/actions/wardrobes";

export default async function MyStudioPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check Studio Access based on 'active_studio_client' column in 'profiles'
    const { data: profile } = await supabase
        .from('profiles')
        .select('active_studio_client, full_name')
        .eq('id', user.id)
        .single();

    if (!profile?.active_studio_client) {
        redirect('/vault/services');
    }

    // Fetch Tailor Card Data
    const { data: tailorCard } = await supabase
        .from('tailor_cards')
        .select('measurements')
        .eq('user_id', user.id)
        .single();

    // The client's own wardrobe (auto-created on first visit) — studio
    // components key on { wardrobeId, ownerId }.
    const { wardrobe } = await getMyWardrobe();
    if (!wardrobe) {
        redirect('/vault');
    }

    return (
        <ClientStudioDashboard
            wardrobeId={wardrobe.id}
            ownerId={user.id}
            initialMeasurements={tailorCard?.measurements}
            userName={profile.full_name?.split(' ')[0] || "Client"}
        />
    );
}
