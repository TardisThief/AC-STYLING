import { Link } from "@/i18n/routing";
import { ArrowLeft, Play } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Shown at /vault/boutique while the boutique is closed (see app/lib/release.ts). */
export default async function BoutiqueComingSoon({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: 'Vault.boutique_soon' });

    return (
        <main className="bg-[#E6DED6]/30 min-h-screen">
            <div className="bg-[#E6DED6] pt-8 pb-12 px-6 border-b border-white/50">
                <div className="container mx-auto">
                    <Link href="/vault" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-6 group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        {t('back')}
                    </Link>
                    <div className="max-w-4xl">
                        <span className="inline-block text-[11px] uppercase tracking-widest font-bold text-ac-gold mb-3">
                            {t('eyebrow')}
                        </span>
                        <h1 className="font-serif text-5xl md:text-7xl text-ac-taupe mb-4">
                            {t('title')}
                        </h1>
                        <p className="text-xl text-ac-coffee font-light max-w-2xl leading-relaxed mb-8">
                            {t('body')}
                        </p>
                        <Link
                            href="/vault/foundations"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ac-espresso text-white text-[11px] font-bold tracking-widest uppercase rounded-sm hover:bg-ac-taupe transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ac-sand"
                        >
                            <Play size={10} className="fill-white" aria-hidden="true" />
                            {t('cta')}
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
