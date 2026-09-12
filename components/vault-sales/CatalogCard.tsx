import SafeImage from "@/components/ui/SafeImage";
import { pickLocale, type CatalogEntry } from "@/app/lib/vault-catalog";

/**
 * One course in the public catalogue. Every fact here comes from the database —
 * nothing about a course is written into this component.
 *
 * An unpublished entry renders as an honest "in production" card: it says so,
 * says it is included with Full Access, and shows a date ONLY when
 * `available_at` is actually set. A null date produces no date, ever.
 */

interface Props {
    entry: CatalogEntry;
    locale: string;
    t: {
        modulesLabel: string;
        runtimeApprox: string;
        includedBadge: string;
        inProductionBadge: string;
        inProductionNote: string;
        availableOn: string;
        cardCta: string;
    };
}

export default function CatalogCard({ entry, locale, t }: Props) {
    const title = pickLocale(locale, entry.title, entry.title_es);
    const subtitle = pickLocale(locale, entry.subtitle, entry.subtitle_es);
    const description = pickLocale(locale, entry.description, entry.description_es);
    const upcoming = !entry.is_published;

    const availableLabel =
        upcoming && entry.available_at
            ? t.availableOn.replace(
                  "{date}",
                  new Intl.DateTimeFormat(locale === "es" ? "es" : "en", {
                      month: "long",
                      year: "numeric",
                  }).format(new Date(entry.available_at))
              )
            : null;

    // "about 1 h" — the source figure is an approximation, so the string keeps
    // the hedge rather than rendering a precise-looking duration.
    const runtimeLabel = entry.runtime_minutes
        ? t.runtimeApprox.replace("{hours}", String(Math.round(entry.runtime_minutes / 60)))
        : null;

    const meta = [
        entry.modules.length > 0 ? `${entry.modules.length} ${t.modulesLabel}` : null,
        runtimeLabel,
    ].filter(Boolean);

    return (
        <article
            className={`flex flex-col border border-ac-taupe/15 bg-white/40 ${
                upcoming ? "opacity-90" : ""
            }`}
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-ac-beige/40">
                {entry.thumbnail_url ? (
                    <SafeImage
                        src={entry.thumbnail_url}
                        alt=""
                        className={`h-full w-full object-cover ${upcoming ? "grayscale" : ""}`}
                    />
                ) : (
                    <div aria-hidden="true" className="h-full w-full bg-ac-beige/60" />
                )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                    {upcoming ? (
                        <span className="border border-ac-taupe/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-ac-taupe/70">
                            {t.inProductionBadge}
                        </span>
                    ) : (
                        <span className="border border-ac-olive/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-ac-olive">
                            {t.includedBadge}
                        </span>
                    )}
                </div>

                <div>
                    <h3 className="font-serif text-2xl leading-tight text-ac-taupe">{title}</h3>
                    {subtitle && <p className="mt-1 text-sm text-ac-taupe/60">{subtitle}</p>}
                </div>

                {description && (
                    <p className="text-[0.95rem] leading-relaxed text-ac-taupe/80">{description}</p>
                )}

                {meta.length > 0 && (
                    <p className="text-xs uppercase tracking-widest text-ac-taupe/50">
                        {meta.join(" · ")}
                    </p>
                )}

                <div className="mt-auto pt-2">
                    {upcoming ? (
                        <p className="text-sm text-ac-taupe/70">
                            {availableLabel ?? t.inProductionNote}
                        </p>
                    ) : (
                        <a
                            href="#flagship"
                            className="inline-block border-b border-ac-taupe/40 pb-0.5 text-sm text-ac-taupe transition-colors hover:border-ac-taupe focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
                        >
                            {t.cardCta}
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
}
