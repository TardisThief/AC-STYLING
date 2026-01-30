
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Layers, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

import FullAccessUnlock from "@/components/vault/FullAccessUnlock";

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
            <FullAccessUnlock userId={user?.id} hasFullAccess={hasFullAccess} />

            {/* MASTERCLASSES GRID */}
            {masterclasses && masterclasses.length > 0 && (
                <div className="mb-12">
                    <h2 className="font-serif text-xl text-ac-taupe mb-6 flex items-center gap-2">
                        <Layers size={20} className="text-ac-gold" />
                        {t('collections')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {masterclasses.map((mc, index) => {
                            const isCompleted = isMasterclassComplete(mc.id);
                            const displayTitle = locale === 'es' && mc.title_es ? mc.title_es : mc.title;
                            const displayDescription = locale === 'es' && mc.description_es ? mc.description_es : mc.description;
                            const displayThumb = mc.thumbnail_url;

                            // If Guest, link goes to #upgrade (or we intercept it)
                            // We can use a simpler conditional: if guest, render a div that looks like a link but isn't, OR just disable the link.

                            const CardContent = (
                                <>
                                    <div className="relative aspect-[16/9] overflow-hidden rounded-sm mb-3 shadow-md group-hover:shadow-xl transition-all duration-500">
                                        <div className="absolute inset-0 bg-ac-taupe/20 group-hover:bg-ac-taupe/0 transition-colors z-10" />
                                        <img
                                            src={displayThumb || "https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop"}
                                            alt={displayTitle}
                                            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isGuest ? 'blur-[2px] grayscale' : 'grayscale group-hover:grayscale-0'}`}
                                        />

                                        {!isGuest && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                                <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/40 text-white font-serif tracking-widest">
                                                    {t('view')}
                                                </div>
                                            </div>
                                        )}

                                        {isGuest && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/20 backdrop-blur-[1px]">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-2">
                                                    <Layers size={18} className="text-white" />
                                                </div>
                                                <span className="text-white text-[10px] uppercase font-bold tracking-widest">Founding Members Only</span>
                                            </div>
                                        )}

                                        {/* Badge - Label */}
                                        <div className="absolute top-4 left-4 z-30">
                                            <span className="bg-ac-gold text-white text-[10px] uppercase font-bold px-3 py-1 tracking-widest rounded-sm">
                                                {t('masterclass_number', { number: index + 1 })}
                                            </span>
                                        </div>

                                        {/* Completion Badge (Top Right) */}
                                        <div className="absolute top-4 right-4 z-30">
                                            {isCompleted && !isGuest && (
                                                <div className="w-8 h-8 rounded-full bg-ac-olive flex items-center justify-center shadow-md ring-1 ring-white/20">
                                                    <Check size={16} className="text-ac-gold" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="font-serif text-2xl text-ac-taupe group-hover:text-ac-olive transition-colors mb-1 flex items-center gap-2">
                                        {displayTitle}
                                        {isGuest && <span className="text-[10px] bg-ac-taupe/10 px-2 py-0.5 rounded-sm text-ac-taupe/60 uppercase font-bold tracking-normal">Locked</span>}
                                    </h3>
                                    <p className="text-ac-taupe/60 text-xs max-w-md line-clamp-2">
                                        {displayDescription}
                                    </p>
                                </>
                            );

                            return isGuest ? (
                                <Link href={`/${locale}/vault/join`} key={mc.id} className="group block relative cursor-pointer opacity-80 hover:opacity-100">
                                    {CardContent}
                                </Link>
                            ) : (
                                <Link href={`/vault/foundations/masterclass/${mc.id}`} key={mc.id} className="group block relative">
                                    {CardContent}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {(!masterclasses || masterclasses.length === 0) && (
                <div className="text-center py-20">
                    <p className="text-ac-taupe/60 mb-4">No collections found.</p>
                    <Link href="/vault/admin" className="text-ac-gold hover:text-ac-olive transition-colors">
                        Go to Admin Dashboard →
                    </Link>
                </div>
            )}
        </section>
    );
}
