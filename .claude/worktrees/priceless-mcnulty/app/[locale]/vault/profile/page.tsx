import { getProfileHubData } from '@/app/actions/vault/profile';
import StyleEssence from '@/components/vault/StyleEssence';
import TailorCardUser from '@/components/vault/TailorCardUser';
import GatedWardrobe from '@/components/vault/GatedWardrobe';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AccountSettings from '@/components/vault/AccountSettings';

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

            {/* Disclaimer / Footer */}
            <div className="mt-12 mb-8 text-center text-[#3D3630]/40 text-[10px] uppercase tracking-widest">
                AC Styling • Vault Profile • ID: {profile.id.slice(0, 8)}
            </div>

            {/* Account Settings Section */}
            <div className="container mx-auto px-4 max-w-4xl pb-12">
                <AccountSettings />
            </div>

            {/* Disclaimer / Footer */}
            <div className="mt-12 mb-8 text-center text-[#3D3630]/40 text-[10px] uppercase tracking-widest">
                AC Styling • Vault Profile • ID: {profile.id.slice(0, 8)}
            </div>

            {/* Account Settings Section */}
            <div className="container mx-auto px-4 max-w-4xl pb-12">
                <AccountSettings />
            </div>
        </div>
    );
}
