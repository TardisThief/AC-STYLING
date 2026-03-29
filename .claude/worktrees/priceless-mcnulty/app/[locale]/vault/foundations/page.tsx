
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Layers, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

import FullAccessUnlock from "@/components/vault/FullAccessUnlock";
import MasterclassCard from "@/components/vault/MasterclassCard";

export default async function FoundationsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Foundations' });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch Masterclasses
    const { data: masterclasses } = await supabase
        .from('masterclasses')
        .select('*')
        .order('order_index', { ascending: true });

    // 2. Fetch all chapters for these masterclasses to calculate completion
    const { data: mcChapters } = await supabase
        .from('chapters')
        .select('id, slug, masterclass_id')
        .not('masterclass_id', 'is', null);

    // User Progress Logic & Check Full Access
    const completedChapters = new Set();
    let hasFullAccess = false;
    let isGuest = false;

    if (user) {
        // Parallel Fetch: Profile & Progress
        const [progressRes, profileRes] = await Promise.all([
            supabase.from('user_progress').select('content_id').eq('user_id', user.id),
            supabase.from('profiles').select('is_guest, has_full_unlock').eq('id', user.id).single()
        ]);

        const progress = progressRes.data;
        const profile = profileRes.data;

        isGuest = profile?.is_guest || false;
        hasFullAccess = profile?.has_full_unlock || false;

        progress?.forEach(p => {
            const parts = p.content_id.split('/');
            const slug = parts.length > 1 ? parts[1] : parts[0];
            completedChapters.add(slug);
        });
    }

    // Helper to check if masterclass is complete
    const isMasterclassComplete = (mcId: string) => {
        if (!mcChapters) return false;
        const chaptersForMc = mcChapters.filter(c => c.masterclass_id === mcId);
        if (chaptersForMc.length === 0) return false; // Empty masterclass not "complete"
        return chaptersForMc.every(c => completedChapters.has(c.slug));
    };



    return (
        <section className="min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-ac-taupe/10 pb-4">
                <div>
                    <Link href="/vault" className="flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-4 group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        {t('back')}
                    </Link>
                    <h1 className="font-serif text-3xl md:text-5xl text-ac-taupe mb-2">
                        {t('title')}
                    </h1>
                    <p className="font-sans text-ac-coffee text-sm tracking-wide">
                        {t('subtitle')}
                    </p>
                </div>

                {isGuest && (
                    <div className="mt-4 md:mt-0 bg-ac-gold/10 px-4 py-2 rounded-sm border border-ac-gold/20">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ac-gold">
                            Guest Preview Mode
                        </p>
                    </div>
                )}
            </div>

            {/* FULL ACCESS UNLOCK BANNER */}
            <FullAccessUnlock userId={!isGuest ? user?.id : undefined} hasFullAccess={hasFullAccess} />

            {/* MASTERCLASSES GRID */}
            {masterclasses && masterclasses.length > 0 && (
                <div className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {masterclasses.map((mc, index) => {
                            const isCompleted = isMasterclassComplete(mc.id);
                            const href = isGuest ? "/vault/join" : `/vault/foundations/masterclass/${mc.id}`;

                            return (
                                <MasterclassCard
                                    key={mc.id}
                                    masterclass={mc}
                                    locale={locale}
                                    isGuest={isGuest}
                                    isCompleted={isCompleted}
                                    index={index}
                                    t={null}
                                    href={href}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {
                (!masterclasses || masterclasses.length === 0) && (
                    <div className="text-center py-20">
                        <p className="text-ac-taupe/60 mb-4">No collections found.</p>
                        <Link href="/vault/admin" className="text-ac-gold hover:text-ac-olive transition-colors">
                            Go to Admin Dashboard →
                        </Link>
                    </div>
                )
            }
        </section >
    );
}
