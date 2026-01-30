
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, FileText, CheckCircle2, Download } from "lucide-react";
import { redirect } from "next/navigation";
import VaultVideoPlayer from "@/components/vault/VaultVideoPlayer";
import EssenceLab from "@/components/vault/EssenceLab";
import MarkComplete from "@/components/vault/MarkComplete";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";
import InteractiveGate from "@/components/auth/InteractiveGate";
import UnlockButton from "@/components/monetization/UnlockButton";

export default async function CourseLessonPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
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
        console.error("CoursePage: Chapter not found", { slug, decodedSlug, error: chapterError });
        return (
            <div className="p-20 text-center">
                <h1 className="text-2xl font-serif text-ac-taupe mb-4">Course Not Found</h1>
                <p className="text-ac-taupe/60 mb-8">The requested course "{decodedSlug}" could not be located.</p>
                <Link href="/vault/courses" className="px-6 py-3 bg-ac-taupe text-white rounded-sm">
                    Return to Courses
                </Link>
            </div>
        );
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

    // Ensure we don't treat anonymous users as "logged in" for purchase flow
    const isAuthenticated = user && !user.is_anonymous;

    // Check Access
    const hasAccess = user ? await checkAccess(user.id, chapter.id) : false;


    let isCompleted = false;

    // Fetch Essence Lab Answers
    const essenceMap: Record<string, string> = {};
    if (user) {
        // ... (lines 58-75) ...
        const targetMasterclassId = chapter.id; // Treat course itself as the container
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
        .eq('content_id', `foundations/${chapter.slug}`) // Keeping ID format consistent for now
        .single() : { data: null };
    isCompleted = !!progress;


    // Calculate Next Standalone Chapter
    let nextChapterSlug: string | null = null;
    if (chapter.is_standalone) {
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

    return (
        <section className="min-h-screen pb-20">
            {/* Nav */}
            <div className="mb-8">
                <Link href="/vault/courses" className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-6 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Courses
                </Link>
                <div className="flex items-baseline gap-4">
                    <div>
                        <span className="inline-block px-3 py-1 mb-2 text-xs font-bold tracking-widest uppercase bg-ac-gold/10 text-ac-gold rounded-sm">
                            Standalone Course
                        </span>
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
                    {/* Video Player (GATED) */}
                    <div className="space-y-6">
                        <InteractiveGate
                            isLocked={!hasAccess}
                            title="Unlock This Course"
                            type="overlay"
                            priceId={chapter.price_id}
                            isLoggedIn={!!isAuthenticated}
                        >
                            <VaultVideoPlayer
                                key={locale}
                                videoId={chapter.video_id}
                                videoIdEs={chapter.video_id_es}
                                title={title}
                                locale={locale}
                            />
                        </InteractiveGate>

                        <div className="flex justify-between items-start">
                            <div className="prose prose-stone max-w-none flex-1">
                                <h3 className="font-serif text-2xl text-ac-taupe mb-2">About this Course</h3>
                                <div className="text-ac-taupe/80 leading-relaxed whitespace-pre-line">
                                    {description || 'Course description available.'}
                                </div>
                            </div>

                            {/* Desktop Completion Button - Only show if accessible */}
                            {hasAccess && (
                                <div className="hidden lg:block ml-6">
                                    <MarkComplete slug={chapter.slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Completion Button */}
                    {hasAccess && (
                        <div className="lg:hidden">
                            <MarkComplete slug={chapter.slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} />
                        </div>
                    )}
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
                            <p className="text-sm text-ac-taupe/40 italic">No takeaways added yet.</p>
                        )}
                    </div>

                    {/* 2. Styling Essence Lab (GATED or Preview?) - Gated for now as it assumes watching */}
                    {hasAccess ? (
                        <EssenceLab
                            masterclassId={null}
                            chapterId={chapter.id}
                            chapterSlug={chapter.slug}
                            initialData={essenceMap}
                            questions={labQuestions}
                        />
                    ) : (
                        <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm opacity-50 cursor-not-allowed">
                            <h3 className="font-serif text-xl text-ac-taupe mb-4 opacity-50">Essence Lab</h3>
                            <p className="text-sm text-ac-taupe/60 italic">Unlock course to access lab questions.</p>
                        </div>
                    )}

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
                                        href={hasAccess ? resource.url : "#"} // Disable link if locked
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`w-full flex items-center justify-between p-3 bg-white/40 border border-transparent transition-all rounded-sm group text-left ${hasAccess ? 'hover:bg-white/60 hover:border-ac-gold/20' : 'opacity-50 cursor-not-allowed'}`}
                                        onClick={(e) => !hasAccess && e.preventDefault()}
                                    >
                                        <span className="text-sm font-bold text-ac-taupe group-hover:text-ac-olive truncate">
                                            {resource.name}
                                        </span>
                                        {hasAccess && <Download size={14} className="text-ac-gold ml-2" />}
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-ac-taupe/40 italic">No resources available.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
