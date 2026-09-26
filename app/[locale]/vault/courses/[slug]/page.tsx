
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import VaultVideoPlayer from "@/components/vault/VaultVideoPlayer";
import MarkComplete from "@/components/vault/MarkComplete";
import CompleteChapterButton from "@/components/vault/CompleteChapterButton";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";
import { getChapterVideo } from "@/app/actions/vault/chapter-video";
import InteractiveGate from "@/components/auth/InteractiveGate";
import UnlockButton from "@/components/monetization/UnlockButton";
import { CHAPTER_CATALOG_COLUMNS } from "@/app/lib/chapter-columns";

import { pageMetadata } from '@/app/lib/seo';
import VaultBreadcrumbs from "@/components/vault/VaultBreadcrumbs";
import ResourcesCard from "@/components/vault/ResourcesCard";
import { loadChapterPaidContent } from "@/app/lib/paid-content";

export const generateMetadata = pageMetadata({ key: 'vaultCourse' });

export default async function CourseLessonPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
    const { slug, locale } = await params;
    const tUnlock = await getTranslations({ locale, namespace: 'Vault.unlock' });
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
        console.error("CoursePage: Chapter not found", { slug, decodedSlug, error: chapterError });
        return (
            <div className="p-20 text-center">
                <h1 className="text-2xl font-serif text-ac-taupe mb-4">Course Not Found</h1>
                <p className="text-ac-taupe/60 mb-8">The requested course &quot;{decodedSlug}&quot; could not be located.</p>
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
    const takeaways = (locale === 'es' && chapter.takeaways_es && chapter.takeaways_es.length > 0)
        ? chapter.takeaways_es
        : (chapter.takeaways || []);

    // Fetch User Data
    const { data: { user } } = await supabase.auth.getUser();

    // Ensure we don't treat anonymous users as "logged in" for purchase flow
    const isAuthenticated = user && !user.is_anonymous;

    // Check Access
    const hasAccess = user ? await checkAccess(user.id, chapter.id) : false;

    // The player used to receive chapter.video_id straight off the row, which
    // shipped the Vimeo id to unentitled visitors too -- InteractiveGate only
    // covers it visually. Now the id is fetched only when access is real.
    const video = hasAccess
        ? await getChapterVideo(chapter.id)
        : { videoId: null, videoIdEs: null };

    // Lab questions and downloads are paid content (migration 30), read after
    // the access check. Without access only the question count comes back.
    const paid = await loadChapterPaidContent(chapter.id, { hasAccess });
    const resources = paid.resources;


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


    // Standalone courses are single lessons — no sequential next chapter
    const nextChapterSlug: string | null = null;

    return (
        <section className="min-h-screen pb-20">
            {/* Nav */}
            <div className="mb-8">
                <VaultBreadcrumbs
                    trail={[
                        { key: "courses", href: "/vault/courses" },
                        { label: title ?? undefined },
                    ]}
                />
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
                            title={tUnlock('gateTitle')}
                            body={tUnlock('gateBody')}
                            unlockLabel={tUnlock('cta')}
                            comingSoonLabel={tUnlock('comingSoon')}
                            type="overlay"
                            priceId={chapter.price_id}
                            isSignedIn={!!isAuthenticated}
                        >
                            <VaultVideoPlayer
                                key={locale}
                                videoId={video.videoId ?? ""}
                                videoIdEs={video.videoIdEs ?? undefined}
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
                                    <MarkComplete slug={chapter.slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} baseRoute="/vault/courses" />
                                    {nextChapterSlug && (
                                        <div className="mt-6 flex justify-end">
                                            <CompleteChapterButton 
                                                slug={chapter.slug} 
                                                chapterId={chapter.id} 
                                                totalQuestions={paid.labQuestionCount} 
                                                nextChapterSlug={nextChapterSlug} 
                                                isCompletedInitial={isCompleted} 
                                                baseRoute="/vault/courses" 
                                                variant="subtle" 
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Completion Button */}
                    {hasAccess && (
                        <div className="lg:hidden">
                            <MarkComplete slug={chapter.slug} isCompletedInitial={isCompleted} nextChapterSlug={nextChapterSlug} baseRoute="/vault/courses" />
                            {nextChapterSlug && (
                                <div className="mt-6 flex justify-center">
                                    <CompleteChapterButton 
                                        slug={chapter.slug} 
                                        chapterId={chapter.id} 
                                        totalQuestions={paid.labQuestionCount} 
                                        nextChapterSlug={nextChapterSlug} 
                                        isCompletedInitial={isCompleted} 
                                        baseRoute="/vault/courses" 
                                        variant="subtle" 
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column (30%) - Stacked Cards */}
                <div className="lg:col-span-3 space-y-6">

                    {hasAccess ? (
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
                    ) : (
                        <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm opacity-50 cursor-not-allowed select-none">
                            <div className="blur-[2px]">
                                <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center gap-2">
                                    <CheckCircle2 size={20} className="text-ac-gold" />
                                    Key Takeaways
                                </h3>
                                <ul className="space-y-3">
                                    {[1, 2, 3].map((_, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-ac-taupe/80 leading-snug">
                                            <span className="text-ac-gold text-lg leading-none">•</span>
                                            <span className="bg-ac-taupe/10 text-transparent rounded-sm">Hidden content for locked course</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="text-xs text-ac-taupe/60 italic uppercase tracking-widest">
                                    Unlock to view
                                </p>
                            </div>
                        </div>
                    )}



                    {/* 3. Resources */}
                    <ResourcesCard resources={resources} hasAccess={hasAccess} />
                </div>
            </div>
        </section>
    );
}
