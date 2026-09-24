
import ConciergeNavbar from "@/components/ConciergeNavbar";
import { getViewer } from "@/app/lib/vault-user";
import RenewAccessBanner from "@/components/vault/RenewAccessBanner";

export default async function VaultLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;
    // Shared with the page via React cache() — one getUser + one profiles query.
    const { user, profile } = await getViewer();
    const isGuest = !user || user.is_anonymous;
    const isAdmin = !isGuest && profile?.role === 'admin';

    return (
        <div className="min-h-screen bg-ac-sand pb-20">
            <ConciergeNavbar isGuest={isGuest} isAdmin={isAdmin} />
            <main className="pt-24 container mx-auto px-6 md:px-12">
                {/* In the layout rather than on each page: an expiry is true of
                    the whole Vault, and she should meet it wherever she lands.
                    It renders nothing outside the last month of her term. */}
                <RenewAccessBanner
                    locale={locale}
                    accessExpiresAt={profile?.access_expires_at as string | null | undefined}
                />
                {children}
            </main>
        </div>
    );
}
