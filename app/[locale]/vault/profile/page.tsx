import { getProfileHubData } from '@/app/actions/vault/profile';
import StyleEssence from '@/components/vault/StyleEssence';
import TailorCardUser from '@/components/vault/TailorCardUser';
import GatedWardrobe from '@/components/vault/GatedWardrobe';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

async function getWardrobeItems(userId: string) {
    const supabase = await createClient();
    console.log(`[WardrobeDebug] Fetching for userId: ${userId}`);

    const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) console.error("[WardrobeDebug] Error:", error);
    console.log(`[WardrobeDebug] Found ${data?.length} items.`);

    return data || [];
}

export default async function ProfileHub() {
    const hubData = await getProfileHubData();

    if (!hubData || !hubData.profile) {
        redirect('/login'); // Should not happen in guarded route
    }

    const { profile, tailorCard, essence } = hubData;
    const isActiveClient = profile?.active_studio_client || false;

    // Only fetch items if helpful, but RLS protects it anyway. 
    // We fetch so we can pass initial state.
    const wardrobeItems = await getWardrobeItems(profile.id);

    return (
        <div className="min-h-screen text-[#3D3630]">
            {/* Header / Essence Section */}
            {/* We want to reduce top padding so it feels tight "Above The Fold" */}
            <div className="pt-8 pb-8">
                <StyleEssence essence={essence} />
            </div>

            {/* Split Grid - Adjusted for vertical compression */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[70vh]">

                {/* Left: Tailor's Card (Approx 35-40%) */}
                <div className="lg:col-span-5 h-full">
                    <TailorCardUser
                        initialMeasurements={tailorCard?.measurements}
                        userId={profile.id}
                        isActiveClient={isActiveClient}
                    />
                </div>

                {/* Right: Gated Wardrobe (Approx 60-65%) */}
                <div className="lg:col-span-7 h-full">
                    <GatedWardrobe
                        isActiveClient={isActiveClient}
                        userId={profile.id}
                        initialItems={wardrobeItems}
                    />
                </div>
            </div>

            {/* Disclaimer / Footer */}
            <div className="mt-12 text-center text-[#3D3630]/40 text-[10px] uppercase tracking-widest">
                AC Styling • Vault Profile • ID: {profile.id.slice(0, 8)}
            </div>
        </div>
    );
}
