
import ConciergeNavbar from "@/components/ConciergeNavbar";
import { getViewer } from "@/app/lib/vault-user";

export default async function VaultLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Shared with the page via React cache() — one getUser + one profiles query.
    const { user, profile } = await getViewer();
    const isGuest = !user || user.is_anonymous;
    const isAdmin = !isGuest && profile?.role === 'admin';

    return (
        <div className="min-h-screen bg-ac-sand pb-20">
            <ConciergeNavbar isGuest={isGuest} isAdmin={isAdmin} />
            <main className="pt-24 container mx-auto px-6 md:px-12">
                {children}
            </main>
        </div>
    );
}
