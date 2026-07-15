import { redirect } from "next/navigation";
import StudioDashboard from "@/components/studio/StudioDashboard";
import { getViewer } from "@/app/lib/vault-user";

export default async function StudioPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;

    // Shared with the Vault layout via React cache(): this page used to repeat
    // the layout's getUser + profiles round-trips instead of reusing them.
    const { user, profile } = await getViewer();

    if (!user) {
        redirect('/login');
    }

    if (profile?.role !== 'admin') {
        redirect('/vault');
    }

    return (
        <div className="flex flex-col min-h-screen bg-ac-sand">
            {/* Header / Nav padding handled by Vault layout usually, 
                but we might want a clean workspace here */}
            <div className="p-4 md:p-8">
                <header className="mb-8">
                    <h1 className="font-serif text-3xl text-ac-taupe">The Studio</h1>
                    <p className="text-xs uppercase tracking-widest text-ac-taupe/40 font-bold">Professional Styling Command Center</p>
                </header>

                <StudioDashboard locale={locale} />
            </div>
        </div>
    );
}
