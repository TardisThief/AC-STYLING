import { getProfileHubData } from '@/app/actions/vault/profile';
import StyleEssence from '@/components/vault/StyleEssence';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AccountSettings from '@/components/vault/AccountSettings';

export default async function ProfileHub() {
    const hubData = await getProfileHubData();

    if (!hubData || !hubData.profile) {
        redirect('/login');
    }

    const { profile, essence } = hubData;

    return (
        <div className="min-h-screen text-[#3D3630]">
            {/* Header / Essence Section */}
            <div className="pt-8 pb-8">
                <StyleEssence essence={essence} />
            </div>

            {/* Account Settings Section */}
            <div className="container mx-auto px-4 max-w-4xl pb-12">
                <AccountSettings />
            </div>

            {/* Footer */}
            <div className="mt-12 mb-8 text-center text-[#3D3630]/40 text-[10px] uppercase tracking-widest">
                AC Styling • Vault Profile • ID: {profile.id.slice(0, 8)}
            </div>
        </div>
    );
}
