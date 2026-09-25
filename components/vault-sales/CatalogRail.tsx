"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

/**
 * The catalogue as one horizontal row instead of a grid.
 *
 * Eight courses stacked one per row made the section a long scroll on a
 * phone. The row scrolls natively (touch, trackpad, shift-wheel, keyboard),
 * snaps to cards, and the next card peeks in so it reads as scrollable.
 *
 * Auto-advance runs only when it's needed: when the cards overflow
 * the row. It advances one card every few seconds and wraps back to the
 * start. It stops for anything that suggests someone is reading or steering:
 * hover, keyboard focus inside the row, a recent touch/wheel/drag, the row
 * being off-screen, or the reader's reduced-motion setting. The pause
 * button is the explicit control WCAG 2.2.2 asks for on moving content.
 *
 * The cards stay server-rendered and are passed in as children, so this
 * component only owns the scrolling.
 */

const ADVANCE_MS = 5000;
/** How long a manual scroll holds off auto-advance, so it doesn't fight the reader. */
const IDLE_AFTER_INTERACTION_MS = 8000;

interface Props {
    children: ReactNode;
    label: string;
    t: { previous: string; next: string; pause: string; play: string };
}

export default function CatalogRail({ children, label, t }: Props) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [overflowing, setOverflowing] = useState(false);
    const [paused, setPaused] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    // Read on every tick rather than kept in state: none of these should
    // re-render anything, they only decide whether the next tick moves.
    const hovering = useRef(false);
    const focusedWithin = useRef(false);
    const inView = useRef(true);
    const lastInteraction = useRef(0);

    /** Distance from one card's left edge to the next: card width plus the gap. */
    const cardStride = useCallback(() => {
        const list = trackRef.current?.querySelector("ul");
        const first = list?.firstElementChild as HTMLElement | null;
        if (!list || !first) return 0;
        const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
        return first.offsetWidth + gap;
    }, []);

    const scrollByCards = useCallback(
        (direction: 1 | -1, wrap: boolean) => {
            const track = trackRef.current;
            if (!track) return;
            const max = track.scrollWidth - track.clientWidth;
            const atEnd = track.scrollLeft >= max - 4;
            const atStart = track.scrollLeft <= 4;

            let left = track.scrollLeft + direction * cardStride();
            if (wrap && direction === 1 && atEnd) left = 0;
            if (wrap && direction === -1 && atStart) left = max;

            track.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
        },
        [cardStride, reducedMotion]
    );

    // Whether there is anything to scroll at all.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const measure = () => setOverflowing(track.scrollWidth > track.clientWidth + 1);
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReducedMotion(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        const track = trackRef.current;
        if (!track || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => {
            inView.current = entry.isIntersecting;
        });
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    const autoplay = overflowing && !paused && !reducedMotion;

    useEffect(() => {
        if (!autoplay) return;
        const timer = setInterval(() => {
            if (hovering.current || focusedWithin.current || !inView.current) return;
            if (document.hidden) return;
            // A card can open its module list in a dialog. That dialog is
            // portalled to <body>, so focus leaving for it does not register as
            // focus within this rail -- and scrolling the row out from under a
            // reader means the card she opened has moved by the time she closes
            // it. Asked of the document rather than wired between the two
            // components, because any dialog over the page is a reason to hold
            // still, not just this one.
            if (document.querySelector('[role="dialog"]')) return;
            if (Date.now() - lastInteraction.current < IDLE_AFTER_INTERACTION_MS) return;
            scrollByCards(1, true);
        }, ADVANCE_MS);
        return () => clearInterval(timer);
    }, [autoplay, scrollByCards]);

    const markInteraction = () => {
        lastInteraction.current = Date.now();
    };

    const items = Children.toArray(children);

    return (
        <div
            className="mt-12"
            // Mouse only: a tap on a phone fires an enter and never a leave,
            // which would stop auto-advance for good after the first touch.
            onPointerEnter={(e) => {
                if (e.pointerType === "mouse") hovering.current = true;
            }}
            onPointerLeave={(e) => {
                if (e.pointerType === "mouse") hovering.current = false;
            }}
            onFocus={() => (focusedWithin.current = true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    focusedWithin.current = false;
                }
            }}
        >
            <div
                ref={trackRef}
                role="region"
                aria-label={label}
                // Focusable so the row can be scrolled with the arrow keys.
                tabIndex={0}
                onPointerDown={markInteraction}
                onWheel={markInteraction}
                onTouchStart={markInteraction}
                onKeyDown={markInteraction}
                className="-mx-6 snap-x snap-mandatory scroll-px-6 overflow-x-auto px-6 pb-4 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive md:mx-0 md:scroll-px-0 md:px-0"
            >
                <ul className="flex gap-6">
                    {items.map((child, i) => (
                        <li
                            key={i}
                            className="flex w-[82%] shrink-0 snap-start [&>*]:w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
                        >
                            {child}
                        </li>
                    ))}
                </ul>
            </div>

            {overflowing && (
                <div className="mt-6 flex items-center justify-end gap-2">
                    {!reducedMotion && (
                        <button
                            type="button"
                            onClick={() => setPaused((p) => !p)}
                            aria-label={paused ? t.play : t.pause}
                            className={controlClass}
                        >
                            {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            markInteraction();
                            scrollByCards(-1, false);
                        }}
                        aria-label={t.previous}
                        className={controlClass}
                    >
                        <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            markInteraction();
                            scrollByCards(1, false);
                        }}
                        aria-label={t.next}
                        className={controlClass}
                    >
                        <ChevronRight size={18} aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );

}

const controlClass =
    "flex h-10 w-10 items-center justify-center border border-ac-taupe/30 text-ac-taupe transition-colors hover:border-ac-taupe hover:bg-ac-taupe hover:text-ac-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-olive";
