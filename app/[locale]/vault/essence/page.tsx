import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getAllEssenceData } from "@/app/actions/essence-lab";
import EssenceJournal from "@/components/vault/EssenceJournal";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export default async function EssencePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch journal data and accessible masterclasses in parallel
    const [journalData, profileRes, grantsRes, allMcRes] = await Promise.all([
        getAllEssenceData(),
        supabase.from('profiles').select('has_full_unlock').eq('id', user.id).single(),
        supabase.from('user_access_grants').select('masterclass_id').eq('user_id', user.id).not('masterclass_id', 'is', null),
        supabase.from('masterclasses').select('id, title').order('order_index', { ascending: true }),
    ]);

    const hasFullUnlock = profileRes.data?.has_full_unlock || false;
    const allMasterclasses = allMcRes.data || [];

    // Build set of accessible masterclass IDs
    const accessibleMcIds = new Set<string>();
    if (hasFullUnlock) {
        allMasterclasses.forEach(mc => accessibleMcIds.add(mc.id));
    } else {
        grantsRes.data?.forEach(g => { if (g.masterclass_id) accessibleMcIds.add(g.masterclass_id); });
    }

    // Filter to only masterclasses user can actually access
    const accessibleMasterclasses = allMasterclasses.filter(mc => accessibleMcIds.has(mc.id));

    return (
        <section className="min-h-screen pb-20 pt-8 container mx-auto px-4">
            <div className="mb-8">
                <Link href="/vault/profile" className="inline-flex items-center text-ac-taupe/60 hover:text-ac-taupe mb-4 transition-colors">
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Profile
                </Link>
                <h1 className="font-serif text-4xl md:text-5xl text-ac-taupe mb-2">
                    My Styling Essence
                </h1>
                <p className="font-sans text-ac-taupe/60 tracking-wide uppercase text-sm max-w-xl">
                    A collection of your personal discoveries.
                </p>
            </div>

            <EssenceJournal data={journalData} allMasterclasses={accessibleMasterclasses} />
        </section>
    );
}
