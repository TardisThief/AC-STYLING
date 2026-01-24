
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, PlayCircle, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function FoundationsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Foundations' });

    // Server-side: Fetch Masterclass Chapters from Database
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch chapters with category filter
    const { data: chapters, error } = await supabase
        .from('chapters')
        .select(`
            *,
            lesson_metadata (*)
        `)
        .eq('category', 'masterclass')
        .order('order_index', { ascending: true });

    if (error) {
        console.error('Error fetching chapters:', error);
    }

    // Fetch user progress if logged in
    const completedChapters = new Set();
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
    }

    // Fallback images if no chapters exist yet
    const defaultImages = {
        'dna': "https://images.unsplash.com/photo-1544413660-1775f02f9012?q=80&w=2070&auto=format&fit=crop",
        'architecture': "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?q=80&w=2095&auto=format&fit=crop",
        'color': "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop",
        'detox': "https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?q=80&w=2080&auto=format&fit=crop",
        'capsule': "https://images.unsplash.com/photo-1490481651871-ab52661227ed?q=80&w=2070&auto=format&fit=crop"
    };

    return (
        <section className="min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-ac-taupe/10 pb-6">
                <div>
                    <Link href="/vault" className="flex items-center gap-2 text-sm uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-4 group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        {t('back')}
                    </Link>
                    <h1 className="font-serif text-4xl md:text-6xl text-ac-taupe mb-2">
                        {t('title')}
                    </h1>
                    <p className="font-sans text-ac-coffee text-lg tracking-wide">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Chapters Grid */}
            {chapters && chapters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {chapters.map((chapter, index) => {
                        const isCompleted = completedChapters.has(chapter.slug);
                        // Use uploaded thumbnail or fallback to default images
                        const imageUrl = chapter.thumbnail_url || (defaultImages as any)[chapter.slug] || defaultImages.dna;

                        return (
                            <div key={chapter.id}>
                                <Link href={`/vault/foundations/${chapter.slug}`} className="group block">
                                    <div className="relative aspect-square overflow-hidden rounded-sm mb-4">
                                        <div className="absolute inset-0 bg-ac-taupe/20 group-hover:bg-ac-taupe/0 transition-colors z-10" />
                                        <img
                                            src={imageUrl}
                                            alt={chapter.title}
                                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                                        />

                                        {/* Completion Badge */}
                                        <div className="absolute top-4 right-4 z-30">
                                            {isCompleted ? (
                                                <div className="w-8 h-8 rounded-full bg-ac-olive flex items-center justify-center shadow-md ring-1 ring-white/20">
                                                    <Check size={16} className="text-ac-gold" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30 text-white/50 text-[10px] font-serif">
                                                    {index + 1}
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Play */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full border border-white/40">
                                                <PlayCircle size={32} className="text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="font-serif text-2xl text-ac-taupe group-hover:text-ac-olive transition-colors mb-1">
                                        {chapter.title || 'Untitled Chapter'}
                                    </h3>
                                    {chapter.subtitle && (
                                        <p className="text-sm text-ac-gold/80">{chapter.subtitle}</p>
                                    )}
                                </Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-ac-taupe/60 mb-4">No masterclass chapters yet.</p>
                    <Link href="/vault/admin" className="text-ac-gold hover:text-ac-olive transition-colors">
                        Add your first chapter →
                    </Link>
                </div>
            )}
        </section>
    );
}
