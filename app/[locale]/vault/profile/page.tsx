import { getProfileHubData } from '@/app/actions/vault/profile';
import { getJourneyStats } from '@/app/actions/vault/journey';
import StyleEssence from '@/components/vault/StyleEssence';
import JourneyTracker from '@/components/vault/JourneyTracker';
import { redirect } from 'next/navigation';
import AccountSettings from '@/components/vault/AccountSettings';
import { Link } from '@/i18n/routing';
import { Printer } from 'lucide-react';

export default async function ProfileHub() {
    const [hubData, journey] = await Promise.all([
        getProfileHubData(),
        getJourneyStats(),
    ]);

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

            {/* Journey Stats */}
            {journey && (
                <div className="container mx-auto px-4 max-w-4xl">
                    <JourneyTracker stats={journey} />
                    <div className="mt-4 flex justify-end">
                        <Link
                            href="/vault/profile/style-card"
                            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 hover:text-ac-gold transition-colors border-b border-transparent hover:border-ac-gold pb-1"
                        >
                            <Printer size={12} />
                            Export Style Card
                        </Link>
                    </div>
                </div>
            )}

            {/* Account Settings Section */}
            <div className="container mx-auto px-4 max-w-4xl pb-12 mt-6">
                <AccountSettings />
            </div>

            {/* Footer */}
            <div className="mt-12 mb-8 text-center text-[#3D3630]/40 text-[10px] uppercase tracking-widest">
                AC Styling • Vault Profile • ID: {profile.id.slice(0, 8)}
            </div>
        </div>
    );
}
