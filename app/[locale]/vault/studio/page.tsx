import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import StudioDashboard from "@/components/studio/StudioDashboard";

export default async function StudioPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

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
