"use client";

import { useEffect, useState } from "react";
import { trackCta } from "@/app/lib/analytics";

/**
 * Mobile-only sticky CTA, revealed once the hero scrolls out of view.
 *
 * Mobile is the majority path here (the page is linked from an Instagram bio),
 * and by the time someone is deep in the curriculum the hero's buy button is
 * thousands of pixels away. It is deliberately absent on desktop, where the
 * offer section is never far.
 *
 * Uses IntersectionObserver against the hero rather than a scroll listener, so
 * there is no work on the scroll thread. Hidden from assistive tech while
 * off-screen so it cannot be tabbed into invisibly.
 */

export default function StickyCta({
    label,
    cta,
    price,
    href,
}: {
    label: string;
    cta: string;
    price: string | null;
    href: string;
}) {
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const hero = document.getElementById("vault-hero");
        if (!hero) return;

        const io = new IntersectionObserver(
            ([entry]) => setShown(!entry.isIntersecting),
            { rootMargin: "-40px 0px 0px 0px" }
        );
        io.observe(hero);
        return () => io.disconnect();
    }, []);

    return (
        <div
            aria-hidden={!shown}
            className={`fixed inset-x-0 bottom-0 z-sticky border-t border-ac-taupe/15 bg-ac-sand/95 backdrop-blur-sm transition-transform duration-300 md:hidden motion-reduce:transition-none ${
                shown ? "translate-y-0" : "translate-y-full"
            }`}
        >
            <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate text-[11px] uppercase tracking-widest text-ac-taupe">
                        {label}
                    </p>
                    {price && (
                        <p className="font-serif text-lg leading-tight text-ac-taupe">{price}</p>
                    )}
                </div>
                <a
                    href={href}
                    onClick={() => trackCta("sticky", "anchor")}
                    tabIndex={shown ? undefined : -1}
                    className="shrink-0 bg-ac-espresso px-5 py-3 text-xs font-bold uppercase tracking-widest text-ac-sand transition-colors hover:bg-ac-taupe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-olive"
                >
                    {cta}
                </a>
            </div>
        </div>
    );
}
