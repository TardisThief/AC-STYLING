import { Link } from "@/i18n/routing";
import { ArrowLeft, BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import EssenceLab from "@/components/vault/EssenceLab";
import CompleteChapterButton from "@/components/vault/CompleteChapterButton";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";

export default async function CoursesEssenceLabPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
    const { slug, locale } = await params;
    const decodedSlug = decodeURIComponent(slug);

    const supabase = await createClient();
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .or(`slug.eq.${slug},slug.eq.${decodedSlug}`)
        .single();

    if (chapterError || !chapter) {
        redirect('/vault/courses');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const hasAccess = await checkAccess(user.id, chapter.id);
    if (!hasAccess) redirect(`/vault/courses/${slug}`);

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

    const essenceMap: Record<string, string> = {};
    const { data: answers } = await supabase
        .from('essence_responses')
        .select('question_key, answer_value')
        .eq('user_id', user.id)
        .eq('chapter_id', chapter.id);

    answers?.forEach(a => {
        essenceMap[a.question_key] = a.answer_value;
    });

    const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_id', `foundations/${slug}`) // Note: Original system used foundations prefix for courses progress
        .single();
    const isCompletedInitial = !!progress;

    const title = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
    
    const labQuestionsRaw = chapter.lab_questions || [];
    const labQuestions = labQuestionsRaw.map((q: Record<string, unknown>) => ({
        ...q,
        label: (locale === 'es' && q.label_es) ? q.label_es : q.label,
        placeholder: (locale === 'es' && q.placeholder_es) ? q.placeholder_es : q.placeholder
    }));

    const totalQuestions = labQuestions.length;

    return (
        <section className="min-h-screen pb-20 pt-6 max-w-4xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 gap-6 border-b border-ac-taupe/10 pb-6">
                <div>
                    <Link
                        href={`/vault/courses/${slug}`}
                        className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-4 group w-fit"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Video
                    </Link>
                    <span className="text-ac-gold uppercase tracking-widest text-[10px] font-bold block mb-1">
                        Essence Lab
                    </span>
                    <h1 className="font-serif text-3xl md:text-4xl text-ac-taupe leading-none">
                        {title}
                    </h1>
                </div>

                <div className="w-full md:w-auto">
                    <CompleteChapterButton
                        slug={slug}
                        chapterId={chapter.id}
                        totalQuestions={totalQuestions}
                        nextChapterSlug={nextChapterSlug}
                        isCompletedInitial={isCompletedInitial}
                        baseRoute="/vault/courses"
                    />
                </div>
            </div>

            <div className="bg-white/40 border border-ac-taupe/10 p-4 md:p-8 rounded-sm shadow-sm">
                <EssenceLab
                    masterclassId={chapter.masterclass_id || null}
                    chapterId={chapter.id}
                    chapterSlug={slug}
                    initialData={essenceMap}
                    questions={labQuestions}
                />
            </div>
        </section>
    );
}
