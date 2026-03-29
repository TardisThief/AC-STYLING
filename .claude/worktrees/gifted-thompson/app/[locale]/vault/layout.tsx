
import ConciergeNavbar from "@/components/ConciergeNavbar";
import { createClient } from "@/utils/supabase/server";

export default async function VaultLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const isGuest = !user || user.is_anonymous;

    let isAdmin = false;
    if (user && !isGuest) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        isAdmin = profile?.role === 'admin';
    }

    return (
        <div className="min-h-screen bg-ac-sand pb-20">
            <ConciergeNavbar isGuest={isGuest} isAdmin={isAdmin} />
            <main className="pt-24 container mx-auto px-6 md:px-12">
                {children}
            </main>
        </div>
    );
}
