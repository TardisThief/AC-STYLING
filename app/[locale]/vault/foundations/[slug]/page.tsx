import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CheckCircle2, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import VaultVideoPlayer from "@/components/vault/VaultVideoPlayer";
import MarkComplete from "@/components/vault/MarkComplete";
import CompleteChapterButton from "@/components/vault/CompleteChapterButton";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";
import { getChapterVideo } from "@/app/actions/vault/chapter-video";
import { CHAPTER_CATALOG_COLUMNS } from "@/app/lib/chapter-columns";

import { pageMetadata } from '@/app/lib/seo';
import VaultBreadcrumbs from "@/components/vault/VaultBreadcrumbs";
import ResourcesCard from "@/components/vault/ResourcesCard";
import type { VaultResource } from "@/app/lib/types";

export const generateMetadata = pageMetadata({ key: 'vaultFoundation' });

export default async function LessonPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
    const { slug, locale } = await params;
    // Decode likely URL-encoded slugs from legacy data
    const decodedSlug = decodeURIComponent(slug);

    // Fetch Chapter from Database
    const supabase = await createClient();
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select(CHAPTER_CATALOG_COLUMNS)
        .or(`slug.eq.${slug},slug.eq.${decodedSlug}`)
        .single();

    if (chapterError || !chapter) {
        redirect('/vault/foundations');
    }

    // Determine Next Chapter Logic
    let nextChapterSlug: string | null = null;
    if (chapter.masterclass_id) {
        const { data: next } = await supabase
            .from('chapters')
            .select('slug')
            .eq('masterclass_id', chapter.masterclass_id)
            .gt('order_index', chapter.order_index)
            .order('order_index', { ascending: true })
            .limit(1)
            .single();
        if (next) nextChapterSlug = next.slug;
    } else if (chapter.is_standalone) {
        const { data: next } = await supabase
            .from('chapters')
            .select('slug')
            .eq('is_standalone', true)
            .gt('order_index', chapter.order_index)
            .order('order_index', { ascending: true })
            .limit(1)
            .single();
        if (next) nextChapterSlug = next.slug;
    }


    // Named parent crumb. A separate query on purpose: CHAPTER_CATALOG_COLUMNS
    // is one unbroken literal that Supabase parses to infer the row shape, so
    // an embedded join cannot be added to it without collapsing that type.
    let masterclassTitle: string | null = null;
    let masterclassResources: VaultResource[] = [];
    if (chapter.masterclass_id) {
        const { data: mc } = await supabase
            .from('masterclasses')
            .select('title, title_es, resource_urls')
            .eq('id', chapter.masterclass_id)
            .single();
        if (mc) {
            masterclassTitle = locale === 'es' && mc.title_es ? mc.title_es : mc.title;
            masterclassResources = (mc.resource_urls as VaultResource[] | null) ?? [];
        }
    }

    // Localize Content
    const title = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
    const subtitle = locale === 'es' && chapter.subtitle_es ? chapter.subtitle_es : chapter.subtitle;
    const description = locale === 'es' && chapter.description_es ? chapter.description_es : chapter.description;
    const labQuestionsRaw = chapter.lab_questions || [];
    // Shared Key Strategy: We map over the SINGLE array of questions, but swap the label/placeholder if locale is ES.
    const labQuestions = labQuestionsRaw.map((q: Record<string, unknown>) => ({
        ...q,
        label: (locale === 'es' && q.label_es) ? q.label_es : q.label,
        placeholder: (locale === 'es' && q.placeholder_es) ? q.placeholder_es : q.placeholder
    }));
    const takeaways = (locale === 'es' && chapter.takeaways_es && chapter.takeaways_es.length > 0)
        ? chapter.takeaways_es
        : (chapter.takeaways || []);
    // A module inside a masterclass shows the masterclass's resources first,
    // then its own — the workbook that covers the whole collection belongs on
    // every module, not duplicated into one of them.
    const resources: VaultResource[] = [
        ...masterclassResources,
        ...((chapter.resource_urls as VaultResource[] | null) ?? []),
    ];

    // Fetch User Data
    const { data: { user } } = await supabase.auth.getUser();

    const essenceMap: Record<string, string> = {};
    if (user) {
        const { data: answers } = await supabase
            .from('essence_responses')
            .select('question_key, answer_value')
            .eq('user_id', user.id)
            .eq('chapter_id', chapter.id);

        answers?.forEach(a => {
            essenceMap[a.question_key] = a.answer_value;
        });
    }

    const { data: progress } = user ? await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_id', `foundations/${slug}`)
        .single() : { data: null };
    const isCompleted = !!progress;

    // Check Access
    const hasAccess = user ? await checkAccess(user.id, chapter.id) : false;

    // Video ids are no longer on the row: migration 09 removed them from
    // what a browser session may read. They are fetched only for a viewer
    // who has actually been granted this chapter.
    const video = hasAccess
        ? await getChapterVideo(chapter.id)
        : { videoId: null, videoIdEs: null };

    return (
        <section className="min-h-screen pb-20">
            {/* Nav ... */}
            <div className="mb-8">
                {/* ... default nav content ... */}
                <VaultBreadcrumbs
                    trail={[
                        { key: "foundations", href: "/vault/foundations" },
                        ...(chapter.masterclass_id
                            ? [{
                                ...(masterclassTitle ? { label: masterclassTitle } : { key: "masterclass" as const }),
                                href: `/vault/foundations/masterclass/${chapter.masterclass_id}`,
                            }]
                            : []),
                        { label: title ?? undefined },
                    ]}
                />
                {/* ... header ... */}
                {/* order_index is authored 1-based in admin ("Order Index" = the show
                    order), so it renders as-is. Adding 1 here made show order 1 read "2". */}
                <div className="flex items-baseline gap-4">
                    <span className="font-serif text-5xl text-ac-taupe/20 font-bold">{chapter.order_index}</span>
                    <div>
                        <h1 className="font-serif text-3xl md:text-5xl text-ac-taupe">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-lg text-ac-gold/80 mt-2">{subtitle}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 70/30 Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-12">

                {/* Left Column (70%) */}
                <div className="lg:col-span-7 space-y-12">
                    {/* Video Player OR Locked State */}
                    <div className="space-y-6">
                        {hasAccess ? (
                            <VaultVideoPlayer
                                key={locale}
                                videoId={video.videoId ?? ""}
                                videoIdEs={video.videoIdEs ?? undefined}
                                title={title}
                                locale={locale}
                            />
                        ) : (
                            <div className="aspect-video bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-16 h-16 bg-ac-taupe/10 rounded-full flex items-center justify-center mb-4">
                                    <Lock size={32} className="text-ac-taupe/40" />
                                </div>
                                <h3 className="font-serif text-2xl text-ac-taupe mb-2">Content Locked</h3>
                                <p className="text-ac-taupe/60 mb-6 max-w-md">
                                    You need to unlock the Masterclass to view this chapter.
                                </p>
                                {/* If it belongs to a Masterclass, we can link back to it for purchase.
                                    Or we can check if the chapter itself has a price. */}
                                {chapter.masterclass_id && (
                                    <Link
                                        href={`/vault/foundations/masterclass/${chapter.masterclass_id}`}
                                        className="bg-ac-gold text-white px-8 py-3 rounded-sm uppercase tracking-widest text-xs font-bold hover:bg-ac-gold/80 transition-colors"
                                    >
                                        Unlock Access
                                    </Link>
                                )}
                            </div>
                        )}

                        {hasAccess && (
                            <div className="flex justify-between items-start">
                                {/* ... Description & Mark Complete ... */}
                                <div className="prose prose-stone max-w-none flex-1">
                                    <h3 className="font-serif text-2xl text-ac-taupe mb-2">About this Chapter</h3>
                                    <div className="text-ac-taupe/80 leading-relaxed whitespace-pre-line">
                                        {description || 'Learn the foundations of this essential style concept.'}
                                    </div>
                                </div>

                                <div className="hidden lg:block ml-6">
                                    <MarkComplete slug={slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} />
                                    {nextChapterSlug && (
                                        <div className="mt-6 flex justify-end">
                                            <CompleteChapterButton 
                                                slug={slug} 
                                                chapterId={chapter.id} 
                                                totalQuestions={labQuestions.length} 
                                                nextChapterSlug={nextChapterSlug} 
                                                isCompletedInitial={isCompleted} 
                                                baseRoute="/vault/foundations" 
                                                variant="subtle" 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Mobile Completion Button */}
                    <div className="lg:hidden">
                        <MarkComplete slug={slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} />
                        {nextChapterSlug && (
                            <div className="mt-6 flex justify-center">
                                <CompleteChapterButton 
                                    slug={slug} 
                                    chapterId={chapter.id} 
                                    totalQuestions={labQuestions.length} 
                                    nextChapterSlug={nextChapterSlug} 
                                    isCompletedInitial={isCompleted} 
                                    baseRoute="/vault/foundations" 
                                    variant="subtle" 
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column (30%) - Stacked Cards */}
                <div className="lg:col-span-3 space-y-6">

                    {/* 1. Key Takeaways */}
                    <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm">
                        <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center gap-2">
                            <CheckCircle2 size={20} className="text-ac-gold" />
                            Key Takeaways
                        </h3>
                        {takeaways.length > 0 ? (
                            <ul className="space-y-3">
                                {takeaways.map((takeaway: string, i: number) => (
                                    <li key={i} className="flex gap-3 text-sm text-ac-taupe/80 leading-snug">
                                        <span className="text-ac-gold text-lg leading-none">•</span>
                                        <span>{takeaway}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-ac-taupe/40 italic">No takeaways added yet. Watch the lesson above to learn!</p>
                        )}
                    </div>



                    {/* 3. Resources — the masterclass's, then this module's */}
                    <ResourcesCard resources={resources} hasAccess={hasAccess} />
                </div>
            </div>
        </section>
    );
}
