import { redirect } from "next/navigation";
import QuickActions from "@/components/vault/QuickActions";
import WhatsNew from "@/components/vault/WhatsNew";
import { getDashboardPulse, getMasterclassCompletionStatus, getEditorialContent } from "@/app/actions/dashboard";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/app/lib/vault-user";

export default async function VaultPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Vault' });

    // Shared with the layout via React cache() — no duplicate auth/profile fetch.
    // Guard before fetching content, as before.
    const { user, profile } = await getViewer();
    if (!user) {
        redirect('/login');
    }

    const [pulse, completion, editorial] = await Promise.all([
        getDashboardPulse(),
        getMasterclassCompletionStatus(),
        getEditorialContent(locale),
    ]);

    // Fall back to auth metadata if the profile row isn't synced yet.
    const fullName = profile?.full_name || user.user_metadata?.full_name || "Style Icon";

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
                    <WhatsNew pulse={pulse} editorial={editorial} />
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
