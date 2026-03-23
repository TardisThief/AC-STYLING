import { Link } from "@/i18n/routing";
import { ArrowLeft, BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import EssenceLab from "@/components/vault/EssenceLab";
import CompleteChapterButton from "@/components/vault/CompleteChapterButton";
import { createClient } from "@/utils/supabase/server";
import { checkAccess } from "@/utils/access-control";

export default async function FoundationsEssenceLabPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
    const { slug, locale } = await params;
    const decodedSlug = decodeURIComponent(slug);

    const supabase = await createClient();
    const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .or(`slug.eq.${slug},slug.eq.${decodedSlug}`)
        .single();

    if (chapterError || !chapter) {
        redirect('/vault/foundations');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const hasAccess = await checkAccess(user.id, chapter.id);
    if (!hasAccess) redirect(`/vault/foundations/${slug}`);

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
        .eq('content_id', `foundations/${slug}`)
        .single();
    const isCompletedInitial = !!progress;

    const title = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
    
    const labQuestionsRaw = chapter.lab_questions || [];
    const labQuestions = labQuestionsRaw.map((q: any) => ({
        ...q,
        label: (locale === 'es' && q.label_es) ? q.label_es : q.label,
        placeholder: (locale === 'es' && q.placeholder_es) ? q.placeholder_es : q.placeholder
    }));

    return (
        <section className="min-h-screen pb-20 pt-8 max-w-4xl mx-auto px-4">
            <div className="mb-12">
                <Link
                    href={`/vault/foundations/${slug}`}
                    className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-8 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Video
                </Link>
                
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-ac-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen size={32} className="text-ac-gold" />
                    </div>
                    <span className="text-ac-gold uppercase tracking-widest text-xs font-bold">
                        Essence Lab
                    </span>
                    <h1 className="font-serif text-3xl md:text-5xl text-ac-taupe">
                        {title}
                    </h1>
                    <p className="text-ac-taupe/60 max-w-lg mx-auto">
                        Distill your learnings from this chapter. Answers are saved automatically. You may skip these questions if you prefer.
                    </p>
                </div>
            </div>

            <div className="bg-white/40 border border-ac-taupe/10 p-4 md:p-8 rounded-sm shadow-sm mb-12">
                <EssenceLab
                    masterclassId={chapter.masterclass_id || null}
                    chapterId={chapter.id}
                    chapterSlug={slug}
                    initialData={essenceMap}
                    questions={labQuestions}
                />
            </div>

            <div className="flex flex-col items-center gap-4">
                <CompleteChapterButton
                    slug={slug}
                    nextChapterSlug={nextChapterSlug}
                    isCompletedInitial={isCompletedInitial}
                    baseRoute="/vault/foundations"
                />
                <p className="text-xs text-ac-taupe/40 uppercase tracking-widest text-center mt-4">
                    You can always return to edit these responses later.
                </p>
            </div>
        </section>
    );
}
