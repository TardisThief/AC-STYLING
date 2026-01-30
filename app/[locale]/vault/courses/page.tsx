
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, PlayCircle, FolderOpen, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import CoursePassUnlock from "@/components/vault/CoursePassUnlock";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Courses' });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch Standalone Chapters (is_standalone = true)
    const { data: chapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('is_standalone', true)
        .order('order_index', { ascending: true });

    // User Progress & Profile Logic
    const completedChapters = new Set();
    let hasCourseAccess = false; // Hide banner if they have it or full access

    if (user) {
        // Parallel Fetch: Profile & Progress
        const [progressRes, profileRes] = await Promise.all([
            supabase.from('user_progress').select('content_id').eq('user_id', user.id),
            supabase.from('profiles').select('has_full_unlock, has_course_pass').eq('id', user.id).single()
        ]);

        const progress = progressRes.data;
        const profile = profileRes.data;

        if (profile) {
            hasCourseAccess = profile.has_full_unlock || profile.has_course_pass || false;
        }

        progress?.forEach(p => {
            if (p.content_id.startsWith('foundations/')) {
                const slug = p.content_id.split('/')[1];
                completedChapters.add(slug);
            }
        });
    }

    return (
        <section className="min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-ac-taupe/10 pb-4">
                <div>
                    {/* ... header content ... */}
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
            </div>

            {/* Course Pass Banner */}
            <div className="mb-8">
                <CoursePassUnlock userId={user?.id} hasCoursePass={hasCourseAccess} />
            </div>

            {/* STANDALONE CHAPTERS GRID */}
            {chapters && chapters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {chapters.map((chapter) => {
                        const isCompleted = completedChapters.has(chapter.slug);
                        const displayTitle = locale === 'es' && chapter.title_es ? chapter.title_es : chapter.title;
                        const displayThumb = chapter.thumbnail_url;

                        return (
                            <Link href={`/vault/courses/${chapter.slug}`} key={chapter.id} className="group block">
                                <div className="relative aspect-[4/3] overflow-hidden rounded-sm mb-3 bg-ac-sand/20">
                                    <div className="absolute inset-0 bg-ac-taupe/10 group-hover:bg-transparent transition-colors z-10" />
                                    {displayThumb ? (
                                        <img
                                            src={displayThumb}
                                            alt={displayTitle}
                                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-ac-taupe/20">
                                            <FolderOpen size={40} />
                                        </div>
                                    )}

                                    {/* Completion Badge */}
                                    <div className="absolute top-4 right-4 z-30">
                                        {isCompleted && (
                                            <div className="w-8 h-8 rounded-full bg-ac-olive flex items-center justify-center shadow-md ring-1 ring-white/20">
                                                <Check size={16} className="text-ac-gold" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                        <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full border border-white/40">
                                            <PlayCircle size={32} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                                <h3 className="font-serif text-xl text-ac-taupe group-hover:text-ac-olive transition-colors">
                                    {displayTitle}
                                </h3>
                                <p className="text-[10px] text-ac-taupe/40 uppercase tracking-widest mt-1">{t('lesson_label')}</p>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-ac-taupe/60 mb-4">{t('no_courses')}</p>
                </div>
            )}
        </section>
    );
}
