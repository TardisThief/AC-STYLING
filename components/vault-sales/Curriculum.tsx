import { pickLocale, type CatalogEntry } from "@/app/lib/vault-catalog";

/**
 * One masterclass, module by module.
 *
 * This is the strongest trust block on the page: it proves there is substance
 * behind the price by showing exactly what gets watched. Every title, paragraph
 * and takeaway comes from the database.
 *
 * It used to be rendered once, full width, for whichever published course had
 * the most modules -- which made a page-width deep dive into one course sit
 * under a catalogue presenting four of them as equals, and left no way at all
 * to read the others. It is now what a catalogue card opens.
 *
 * Built on native <details>/<summary> so it opens with no JavaScript, is
 * keyboard-operable for free, and its content stays in the DOM for search and
 * for anyone reading with assistive tech.
 *
 * Numbered markers are used here and nowhere else on the page: modules are
 * genuinely a sequence taken in order, so the number carries information rather
 * than decorating a list.
 */

interface Props {
    entry: CatalogEntry;
    locale: string;
    takeawaysLabel: string;
}

function takeawaysFor(locale: string, en: unknown, es: unknown): string[] {
    const pick = locale === "es" && Array.isArray(es) && es.length > 0 ? es : en;
    return Array.isArray(pick) ? pick.filter((x): x is string => typeof x === "string") : [];
}

export default function Curriculum({ entry, locale, takeawaysLabel }: Props) {
    return (
        <ol className="mt-10 border-t border-ac-taupe/15">
            {entry.modules.map((m, i) => {
                const title = pickLocale(locale, m.title, m.title_es);
                const description = pickLocale(locale, m.description, m.description_es);
                const takeaways = takeawaysFor(locale, m.takeaways, m.takeaways_es);

                return (
                    <li key={m.id} className="border-b border-ac-taupe/15">
                        <details className="group">
                            <summary className="flex cursor-pointer list-none items-baseline gap-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-olive">
                                {/* The module number is information, not decoration:
                                    it is the sequence the reader is being asked to
                                    follow. At /35 it measured 1.68 against sand, so
                                    it is full-strength and simply smaller. */}
                                <span
                                    aria-hidden="true"
                                    className="font-serif text-base tabular-nums text-ac-taupe"
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="flex-1 font-serif text-xl text-ac-taupe md:text-2xl">
                                    {title}
                                </span>
                                {/* Rotates on open — motion answering an action, which is
                                    the only kind of motion on this page. */}
                                <span
                                    aria-hidden="true"
                                    className="mt-1 shrink-0 text-ac-taupe/40 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                                >
                                    +
                                </span>
                            </summary>

                            <div className="pb-7 pl-[2.6rem] pr-2">
                                {description && (
                                    <p className="max-w-2xl leading-relaxed text-ac-taupe">
                                        {description}
                                    </p>
                                )}
                                {takeaways.length > 0 && (
                                    <div className="mt-5">
                                        <p className="text-[11px] uppercase tracking-widest text-ac-taupe">
                                            {takeawaysLabel}
                                        </p>
                                        <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-2">
                                            {takeaways.map((tk) => (
                                                <li
                                                    key={tk}
                                                    className="border border-ac-taupe/20 px-2.5 py-1 text-sm text-ac-taupe"
                                                >
                                                    {tk}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </details>
                    </li>
                );
            })}
        </ol>
    );
}
