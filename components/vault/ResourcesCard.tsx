import { FileText, Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { VaultResource } from "@/app/lib/types";
import ResourceLinkRow from "./ResourceLinkRow";

interface ResourcesCardProps {
    resources: VaultResource[];
    hasAccess: boolean;
}

/**
 * The Resources panel on a chapter page.
 *
 * Both chapter pages hand-rolled this card, and they had drifted: the courses
 * page gated it behind `hasAccess` with a blurred placeholder while the
 * foundations page rendered the real download links to anyone who could load
 * the page. One component, gated, so there is one answer.
 */
export default async function ResourcesCard({ resources, hasAccess }: ResourcesCardProps) {
    const t = await getTranslations('Foundations');

    if (!hasAccess) {
        return (
            <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm opacity-50 cursor-not-allowed select-none">
                <div className="blur-[2px]" aria-hidden="true">
                    <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-ac-taupe" />
                        {t('resources')}
                    </h3>
                    <div className="space-y-3">
                        {[0, 1].map(i => (
                            <div
                                key={i}
                                className="w-full flex items-center justify-between p-3 bg-white/40 border border-transparent rounded-sm"
                            >
                                <span className="text-sm font-bold text-transparent bg-ac-taupe/10 rounded-sm">
                                    Hidden Resource Name
                                </span>
                                <Download size={14} className="text-ac-gold/20 ml-2" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-xs text-ac-taupe/60 italic uppercase tracking-widest">
                        {t('unlockToView')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-sm shadow-sm">
            <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center gap-2">
                <FileText size={20} className="text-ac-taupe" aria-hidden="true" />
                {t('resources')}
            </h3>
            {resources.length > 0 ? (
                <div className="space-y-3">
                    {resources.map((resource, i) => (
                        <ResourceLinkRow key={`${resource.url}-${i}`} resource={resource} />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-ac-taupe/40 italic">{t('noResources')}</p>
            )}
        </div>
    );
}
