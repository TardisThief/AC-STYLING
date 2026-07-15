import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ClientStudioDashboard from "@/components/studio/ClientStudioDashboard";
import { getMyWardrobe } from "@/app/actions/wardrobes";
import { getViewer } from "@/app/lib/vault-user";

export default async function MyStudioPage() {
    // Shared with the Vault layout via React cache(): this page used to repeat
    // the layout's getUser + profiles round-trips instead of reusing them.
    const { user, profile } = await getViewer();

    if (!user) {
        redirect('/login');
    }

    if (!profile?.active_studio_client) {
        redirect('/vault/services');
    }

    // Fetch Tailor Card Data
    const supabase = await createClient();
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
            initialMeasurements={(tailorCard?.measurements ?? {}) as Record<string, string>}
            userName={profile.full_name?.split(' ')[0] || "Client"}
        />
    );
}
