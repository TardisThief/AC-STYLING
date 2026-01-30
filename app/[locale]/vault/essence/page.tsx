import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getAllEssenceData } from "@/app/actions/essence-lab"; // Ensure this path is correct
import EssenceJournal from "@/components/vault/EssenceJournal";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export default async function EssencePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const journalData = await getAllEssenceData();

    return (
        <section className="min-h-screen pb-20 pt-8 container mx-auto px-4">
            <div className="mb-8">
                <Link href="/vault" className="inline-flex items-center text-ac-taupe/60 hover:text-ac-taupe mb-4 transition-colors">
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Vault
                </Link>
                <h1 className="font-serif text-4xl md:text-5xl text-ac-taupe mb-2">
                    My Styling Essence
                </h1>
                <p className="font-sans text-ac-taupe/60 tracking-wide uppercase text-sm max-w-xl">
                    A collection of your personal discoveries.
                </p>
            </div>

            <EssenceJournal data={journalData} />
        </section>
    );
}
