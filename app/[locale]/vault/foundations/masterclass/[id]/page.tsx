
import { Link } from "@/i18n/routing";
import { ArrowLeft, PlayCircle, FolderOpen, Check, Lock, Unlock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { checkAccess } from "@/utils/access-control";
import UnlockButton from "@/components/monetization/UnlockButton";
import RestorePurchasesButton from "@/components/monetization/RestorePurchasesButton";
import CheckoutSyncHandler from "@/components/monetization/CheckoutSyncHandler";

export const dynamic = 'force-dynamic';

export default async function MasterclassPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Ensure we don't treat anonymous users as "logged in" for purchase flow
    const isAuthenticated = user && !user.is_anonymous;

    console.log(`[MasterclassPage] ID: ${id}, User found: ${!!user}`, user?.email);

    // 1. Fetch Masterclass Details
    const { data: masterclass, error: mcError } = await supabase
        .from('masterclasses')
        .select('*')
        .eq('id', id)
        .single();

    if (mcError || !masterclass) {
        redirect('/vault/foundations');
    }

    // Check Access
    const hasAccess = user ? await checkAccess(user.id, masterclass.id) : false;

    // 2. Fetch Chapters in this Masterclass
    const { data: chapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('masterclass_id', id)
        .order('order_index', { ascending: true });

    // 3. User Progress Logic
    const completedChapters = new Set();
    let firstIncompleteSlug = chapters?.[0]?.slug;

    if (user) {
        const { data: progress } = await supabase
            .from('user_progress')
            .select('content_id')
            .eq('user_id', user.id);

        progress?.forEach(p => {
            if (p.content_id.startsWith('foundations/')) {
                const slug = p.content_id.split('/')[1];
                completedChapters.add(slug);
            }
        });

        // Find first incomplete
        const firstIncomplete = chapters?.find(c => !completedChapters.has(c.slug));
        if (firstIncomplete) firstIncompleteSlug = firstIncomplete.slug;
    }

    const totalChapters = chapters?.length || 0;
    const completedCount = chapters?.filter(c => completedChapters.has(c.slug)).length || 0;
    const progressPercent = totalChapters > 0 ? (completedCount / totalChapters) * 100 : 0;

    // Localize Masterclass Info
    const mcTitle = locale === 'es' && masterclass.title_es ? masterclass.title_es : masterclass.title;
    const mcDescription = locale === 'es' && masterclass.description_es ? masterclass.description_es : masterclass.description;

    return (
        <section className="min-h-screen">
            <CheckoutSyncHandler />
            {/* Nav */}
            <div className="mb-8 border-b border-ac-taupe/10 pb-6">
                <Link href="/vault/foundations" className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-6 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Collections
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                    {/* Thumbnail */}
                    <div className="lg:col-span-3 aspect-video rounded-sm overflow-hidden shadow-lg relative group">
                        <img
                            src={masterclass.thumbnail_url || "https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop"}
                            alt={mcTitle}
                            className={`w-full h-full object-cover transition-all duration-700 ${!hasAccess ? 'group-hover:scale-105 filter brightness-75' : ''}`}
                        />
                        {!hasAccess && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                                <Lock className="text-white/80 w-12 h-12" />
                            </div>
                        )}
                    </div>

                    {/* Info + CTA */}
                    <div className="lg:col-span-5">
                        <span className="inline-block px-3 py-1 mb-3 text-xs font-bold tracking-widest uppercase bg-ac-gold/10 text-ac-gold rounded-sm">
                            Masterclass Collection
                        </span>
                        <h1 className="font-serif text-4xl md:text-5xl text-ac-taupe mb-3">
                            {mcTitle}
                        </h1>
                        <p className="text-ac-taupe/70 text-base mb-6">
                            {masterclass.subtitle || (locale === 'es' && masterclass.subtitle_es ? masterclass.subtitle_es : '')}
                        </p>

                        {/* CTA / Progress Bar */}
                        <div className="space-y-4">
                            {hasAccess ? (
                                <>
                                    <div className="flex justify-between text-xs uppercase tracking-widest text-ac-taupe/60 mb-2">
                                        <span>Progress</span>
                                        <span>{completedCount} / {totalChapters} Lessons</span>
                                    </div>
                                    <div className="h-1 w-full bg-ac-taupe/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-ac-gold transition-all duration-500"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>

                                    <Link
                                        href={`/vault/foundations/${firstIncompleteSlug}`}
                                        className="inline-flex items-center gap-2 bg-ac-taupe text-white px-6 py-3 rounded-sm hover:bg-ac-olive transition-colors uppercase tracking-widest text-xs font-bold"
                                    >
                                        <PlayCircle size={16} />
                                        Continue Learning
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <UnlockButton
                                        priceId={masterclass.price_id}
                                        isLoggedIn={!!isAuthenticated}
                                        returnUrl={`/vault/foundations/masterclass/${id}`}
                                    />
                                    <div className="flex justify-center pt-2">
                                        <RestorePurchasesButton />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* About This Masterclass Box */}
                    {mcDescription && (
                        <div className="lg:col-span-4 bg-white/60 backdrop-blur-sm border border-ac-taupe/10 rounded-sm p-6 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-ac-gold mb-4">
                                {locale === 'es' ? 'Acerca de este Masterclass' : 'About This Masterclass'}
                            </h3>
                            <div className="text-ac-taupe/80 text-sm leading-relaxed whitespace-pre-line">
                                {mcDescription}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chapters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {chapters && chapters.map((chapter, index) => {
                    const isCompleted = completedChapters.has(chapter.slug);
                    const chTitle = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
                    const chSubtitle = locale === 'es' && chapter.subtitle_es ? chapter.subtitle_es : chapter.subtitle;
                    const chThumb = chapter.thumbnail_url;

                    const CardContent = (
                        <>
                            <div className="relative aspect-video overflow-hidden rounded-sm mb-3 bg-ac-sand/20">
                                <div className="absolute inset-0 bg-ac-taupe/10 group-hover:bg-transparent transition-colors z-10" />
                                {chThumb ? (
                                    <img
                                        src={chThumb}
                                        alt={chTitle}
                                        className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${hasAccess ? 'grayscale group-hover:grayscale-0' : 'grayscale filter contrast-75'}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-ac-taupe/20">
                                        <FolderOpen size={32} />
                                    </div>
                                )}

                                <div className="absolute top-2 right-2 z-30">
                                    {hasAccess ? (
                                        isCompleted ? (
                                            <div className="bg-ac-olive text-white p-1 rounded-full shadow-md">
                                                <Check size={14} />
                                            </div>
                                        ) : (
                                            <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-sm text-white/80 text-[10px] uppercase font-bold">
                                                {index + 1}
                                            </div>
                                        )
                                    ) : (
                                        <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-full text-white/80">
                                            <Lock size={12} />
                                        </div>
                                    )}
                                </div>

                                {hasAccess && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full border border-white/40">
                                            <PlayCircle size={24} className="text-white" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <h3 className="font-serif text-xl text-ac-taupe group-hover:text-ac-olive transition-colors flex items-center gap-2">
                                {chTitle}
                            </h3>
                            <p className="text-sm text-ac-taupe/60 line-clamp-1 mt-1">
                                {chSubtitle}
                            </p>
                        </>
                    );

                    return hasAccess ? (
                        <Link href={`/vault/foundations/${chapter.slug}`} key={chapter.id} className="group block relative">
                            {CardContent}
                        </Link>
                    ) : (
                        <div key={chapter.id} className="group block relative opacity-70 cursor-not-allowed">
                            {CardContent}
                        </div>
                    );
                })}
            </div>

            {(!chapters || chapters.length === 0) && (
                <div className="text-center py-20 border-t border-ac-taupe/10 mt-12">
                    <p className="text-ac-taupe/40 italic">Coming soon.</p>
                </div>
            )}
        </section>
    );
}
