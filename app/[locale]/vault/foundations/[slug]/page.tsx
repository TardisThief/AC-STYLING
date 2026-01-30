import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, FileText, CheckCircle2, Download, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import VaultVideoPlayer from "@/components/vault/VaultVideoPlayer";
import EssenceLab from "@/components/vault/EssenceLab";
import MarkComplete from "@/components/vault/MarkComplete";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
    const { slug, locale } = await params;
    // Decode likely URL-encoded slugs from legacy data
    const decodedSlug = decodeURIComponent(slug);

    // Fetch Chapter from Database
    const supabase = await createClient();
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
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

    // Localize Content
    const title = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
    const subtitle = locale === 'es' && chapter.subtitle_es ? chapter.subtitle_es : chapter.subtitle;
    const description = locale === 'es' && chapter.description_es ? chapter.description_es : chapter.description;
    const labQuestionsRaw = chapter.lab_questions || [];
    // Shared Key Strategy: We map over the SINGLE array of questions, but swap the label/placeholder if locale is ES.
    const labQuestions = labQuestionsRaw.map((q: any) => ({
        ...q,
        label: (locale === 'es' && q.label_es) ? q.label_es : q.label,
        placeholder: (locale === 'es' && q.placeholder_es) ? q.placeholder_es : q.placeholder
    }));
    const takeaways = (locale === 'es' && chapter.takeaways_es && chapter.takeaways_es.length > 0)
        ? chapter.takeaways_es
        : (chapter.takeaways || []);
    const resourceUrls = chapter.resource_urls || [];

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

    return (
        <section className="min-h-screen pb-20">
            {/* Nav ... */}
            <div className="mb-8">
                {/* ... default nav content ... */}
                <Link
                    href={chapter.masterclass_id ? `/vault/foundations/masterclass/${chapter.masterclass_id}` : '/vault/foundations'}
                    className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-6 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to {chapter.masterclass_id ? 'Masterclass' : 'Collections'}
                </Link>
                {/* ... header ... */}
                <div className="flex items-baseline gap-4">
                    <span className="font-serif text-5xl text-ac-taupe/20 font-bold">#</span>
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
                                videoId={chapter.video_id}
                                videoIdEs={chapter.video_id_es}
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
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Mobile Completion Button */}
                    <div className="lg:hidden">
                        <MarkComplete slug={slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} />
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

                    {/* 2. Styling Essence Lab (Always show - has fallback questions) */}
                    <EssenceLab
                        masterclassId={chapter.masterclass_id || null}
                        chapterId={chapter.id}
                        chapterSlug={slug}
                        initialData={essenceMap}
                        questions={labQuestions}
                    />

                    {/* 3. Resources */}
                    <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm">
                        <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-ac-taupe" />
                            Resources
                        </h3>
                        {resourceUrls.length > 0 ? (
                            <div className="space-y-3">
                                {resourceUrls.map((resource: { name: string, url: string }, i: number) => (
                                    <a
                                        key={i}
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-3 bg-white/40 hover:bg-white/60 border border-transparent hover:border-ac-gold/20 transition-all rounded-sm group text-left"
                                    >
                                        <span className="text-sm font-bold text-ac-taupe group-hover:text-ac-olive truncate">
                                            {resource.name}
                                        </span>
                                        <Download size={14} className="text-ac-gold ml-2" />
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-ac-taupe/40 italic">No resources available for this chapter yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
