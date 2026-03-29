
import { createClient } from "@/utils/supabase/server";
import { getFlatEssenceAnswers } from "@/app/actions/essence-lab";
import ServicesGrid from "@/components/vault/ServicesGrid";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Sparkles, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ServicesPage({ params }: { params: { locale: string } }) {
    const { locale } = params;
    const t = await getTranslations({ locale, namespace: 'Studio' });
    const supabase = await createClient();

    // Fetch Services
    const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('order_index', { ascending: true });

    // Fetch User Essence for Recommendation
    const { data: { user } } = await supabase.auth.getUser();
    const isGuest = !user || user.is_anonymous;
    const essenceAnswers = await getFlatEssenceAnswers();

    // Simple Recommendation Logic
    let recommendedServiceId: string | null = null;
    let recommendationReason: string = "";

    if (services && essenceAnswers.length > 0) {
        // Create a set of answered keys
        const answeredKeys = new Set(essenceAnswers.map(a => a.question_key));

        // Find first service that matches
        const match = services.find(service => {
            if (!service.recommendation_tags || service.recommendation_tags.length === 0) return false;
            // Check if any tag matches an answered question key
            return service.recommendation_tags.some((tag: string) => answeredKeys.has(tag));
        });

        if (match) {
            recommendedServiceId = match.id;
            recommendationReason = `Based on your Styling Lab Essence, I recommend starting with the ${match.title} to clear the canvas for your new narrative.`;
        }
    }

    // Fetch profile for VIP check
    let isActiveClient = false;
    let userName = "";
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('active_studio_client, full_name')
            .eq('id', user.id)
            .single();
        isActiveClient = profile?.active_studio_client || false;
        userName = profile?.full_name?.split(' ')[0] || "";
    }

    // Split services
    const sessionServices = services?.filter(s => s.type === 'session').map(s => ({
        ...s,
        title: locale === 'es' && s.title_es ? s.title_es : s.title,
        subtitle: locale === 'es' && s.subtitle_es ? s.subtitle_es : s.subtitle,
        description: locale === 'es' && s.description_es ? s.description_es : s.description,
        price_display: locale === 'es' && s.price_display_es ? s.price_display_es : s.price_display,
    })) || [];

    const retainerServiceRaw = services?.find(s => s.type === 'retainer');
    const retainerService = retainerServiceRaw ? {
        ...retainerServiceRaw,
        title: locale === 'es' && retainerServiceRaw.title_es ? retainerServiceRaw.title_es : retainerServiceRaw.title,
        subtitle: locale === 'es' && retainerServiceRaw.subtitle_es ? retainerServiceRaw.subtitle_es : retainerServiceRaw.subtitle,
        description: locale === 'es' && retainerServiceRaw.description_es ? retainerServiceRaw.description_es : retainerServiceRaw.description,
        price_display: locale === 'es' && retainerServiceRaw.price_display_es ? retainerServiceRaw.price_display_es : retainerServiceRaw.price_display,
    } : undefined;

    return (
        <section className="min-h-screen pb-20 bg-[#E6DED6]">
            <div className="container mx-auto px-6 pt-6 pb-12">
                {/* Header */}
                <div className="mb-6 text-center">
                    <Link href="/vault" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-4 group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        {t('back')}
                    </Link>
                    <h1 className="font-serif text-4xl md:text-5xl text-ac-taupe mb-2 leading-tight">
                        {t('title')}
                    </h1>
                    <p className="font-sans text-ac-taupe/60 text-xs md:text-sm tracking-[0.2em] uppercase">
                        {t('subtitle')}
                    </p>
                </div>

                {/* VIP Entrance */}
                {isActiveClient && (
                    <div className="max-w-4xl mx-auto mb-16 bg-gradient-to-br from-ac-taupe/5 to-white/40 border border-ac-taupe/10 p-8 rounded-sm text-center relative overflow-hidden group hover:border-ac-gold/30 transition-all shadow-sm">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Sparkles size={150} className="text-ac-gold" strokeWidth={0.5} />
                        </div>

                        <p className="text-[10px] uppercase tracking-widest font-bold text-ac-gold mb-3">Private Access</p>
                        <h2 className="font-serif text-3xl text-ac-taupe mb-3">Welcome back, {userName || 'Client'}</h2>
                        <p className="text-ac-taupe/60 text-xs italic mb-8 max-w-md mx-auto leading-relaxed">
                            Your personal studio is ready. Review your lookbooks, manage your virtual wardrobe, and collaborate with your stylist.
                        </p>

                        <Link
                            href="/vault/my-studio"
                            className="inline-flex items-center gap-3 bg-ac-taupe text-white px-8 py-3 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-ac-gold transition-colors shadow-lg z-10 relative group-hover:translate-x-1 duration-300"
                        >
                            Enter My Studio
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                )}

                {/* Main Content Area handled by Client Component */}
                <ServicesGrid
                    sessionServices={sessionServices}
                    retainerService={retainerService}
                    recommendedServiceId={recommendedServiceId}
                    recommendationReason={recommendationReason}
                    isGuest={isGuest}
                />
            </div>
        </section>
    );
}
