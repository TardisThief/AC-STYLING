import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import VaultHero from "@/components/vault/VaultHero";
import QuickActions from "@/components/vault/QuickActions";
import WhatsNew from "@/components/vault/WhatsNew";
import { getDashboardPulse, getMasterclassCompletionStatus } from "@/app/actions/dashboard";
import { getTranslations } from "next-intl/server";

export default async function VaultPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Vault' });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch profile and dynamic content concurrently
    const [profileRes, pulse, completion] = await Promise.all([
        supabase.from('profiles').select('full_name, is_guest').eq('id', user.id).single(),
        getDashboardPulse(),
        getMasterclassCompletionStatus()
    ]);

    const profile = profileRes.data;

    // Fetch profile
    let fullName = "Guest";
    if (profile?.full_name) {
        fullName = profile.full_name;
    } else {
        // Fallback to metadata if profile is not yet created/synced
        fullName = user.user_metadata?.full_name || "Style Icon";
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Simple Greeting Header - Compressed */}
            <div className="fade-in-up pt-2">
                <h1 className="font-serif text-2xl md:text-3xl text-ac-taupe">
                    {t('welcome', { name: fullName })}
                </h1>
            </div>

            {/* Main Content Grid: WhatsNew (Left) + QuickActions (Right Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                {/* Main: What's New takes 3 cols - Order 2 on mobile, 1 on desktop */}
                <div className="lg:col-span-3 order-2 lg:order-1">
                    <WhatsNew pulse={pulse} />
                </div>

                {/* Sidebar: Quick Actions - Order 1 on mobile, 2 on desktop */}
                <div className="lg:col-span-1 order-1 lg:order-2">
                    <QuickActions isMasterclassComplete={completion.isComplete} isGuest={profile?.is_guest || false} />
                </div>
            </div>

            {/* Footer: Recommendations removed per user request */}
        </div>
    );
}
