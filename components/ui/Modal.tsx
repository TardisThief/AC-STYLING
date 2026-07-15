"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Accessible name for the dialog. Rendered as the heading unless `hideTitle`. */
    title: string;
    /** Small line under the title. */
    subtitle?: string;
    /** Set when the body supplies its own heading; the title still names the dialog. */
    hideTitle?: boolean;
    /** Tailwind max-width class, e.g. "max-w-md". */
    widthClass?: string;
    /** Extra classes for the panel (height, layout). */
    panelClassName?: string;
    children: ReactNode;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * The Studio's one dialog. Before this, five surfaces hand-rolled the same
 * backdrop and none of them were reachable by keyboard: no dialog role, no
 * focus trap, no Escape. Every fix had to be made five times, so it never was.
 *
 * Escape closes, focus is trapped while open and restored to the trigger on
 * close, and the page behind is inert to screen readers via aria-hidden on the
 * backdrop's siblings — approximated here by aria-modal, which is enough given
 * the modal renders at the top of the stacking context.
 */
export default function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    hideTitle = false,
    widthClass = "max-w-md",
    panelClassName = "",
    children,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        restoreFocusRef.current = document.activeElement as HTMLElement | null;

        // Move focus into the dialog so the next Tab stays inside it.
        const focusFirst = () => {
            const panel = panelRef.current;
            if (!panel) return;
            const target = panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
            target.focus();
        };
        const raf = requestAnimationFrame(focusFirst);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== "Tab") return;

            const panel = panelRef.current;
            if (!panel) return;
            // The selector already excludes disabled controls and tabindex="-1".
            // Don't filter on offsetParent: it is null for fixed-position elements,
            // which would silently shrink the trap to a single item.
            const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
                .filter(el => !el.hasAttribute("hidden"));
            if (items.length === 0) return;

            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            restoreFocusRef.current?.focus?.();
        };
    }, [isOpen, onClose]);

    const titleId = `modal-title-${title.replace(/\W+/g, "-").toLowerCase()}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                    className="fixed inset-0 z-modal bg-ac-taupe/70 backdrop-blur-md flex items-center justify-center p-6"
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.96, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className={`bg-white w-full ${widthClass} rounded-sm shadow-2xl relative outline-none ${panelClassName}`}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={`Close ${title}`}
                            className="absolute top-4 right-4 z-10 p-1 rounded-sm text-ac-taupe/40 hover:text-ac-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold transition-colors"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>

                        <h2 id={titleId} className={hideTitle ? "sr-only" : "font-serif text-2xl text-ac-taupe px-8 pt-8"}>
                            {title}
                        </h2>
                        {subtitle && !hideTitle && (
                            <p className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 px-8 pt-1">
                                {subtitle}
                            </p>
                        )}

                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
