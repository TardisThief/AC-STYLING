"use client";

import { useState, type ReactNode } from "react";
import Modal from "@/components/ui/Modal";

/**
 * The catalogue card's way of showing what is actually in a masterclass.
 *
 * A dialog rather than an expansion inside the card, because the card lives in
 * a horizontally scrolling rail: its `<ul>` is flex, so one card growing taller
 * drags every sibling up with it; the track is snap-mandatory, which fights
 * content growing past a snap point; and auto-advance resumes eight seconds
 * after a mouse interaction, which would slide an open panel out of view.
 *
 * One happy accident holds this together. `Modal` renders in place rather than
 * through a portal, so while it is open its DOM sits inside the rail's `<li>`
 * and the rail's own focus-within tracking sees focus inside itself -- which
 * pauses auto-advance for exactly as long as the dialog is open, with no
 * coordination between the two components.
 *
 * The curriculum arrives as `children`, already rendered on the server. Nothing
 * about a course crosses into the client bundle that the page was not already
 * shipping.
 */

interface Props {
    /** The visible text of the trigger, e.g. "5 modules". */
    label: string;
    /** The trigger's accessible name: "5 modules" alone does not say what it does. */
    openLabel: string;
    /** Dialog heading, e.g. "Colorimetry, module by module". */
    title: string;
    children: ReactNode;
}

export default function CurriculumDialog({ label, openLabel, title, children }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Inherits the meta line's type so it reads as part of the line it
                sits in, not as a third button competing with Buy. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={openLabel}
                aria-haspopup="dialog"
                className="cursor-pointer border-b border-ac-taupe/40 pb-0.5 uppercase tracking-widest text-ac-taupe transition-colors hover:border-ac-taupe hover:text-ac-espresso focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ac-olive"
            >
                {label}
            </button>

            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                title={title}
                widthClass="max-w-2xl"
                // The panel is capped and the scroll lives on the body below, so
                // the heading and the close button stay put while a seven-module
                // curriculum scrolls past them.
                panelClassName="max-h-[85dvh] flex flex-col"
            >
                <div className="overflow-y-auto px-5 pb-6 pt-3 sm:px-8 sm:pb-8">{children}</div>
            </Modal>
        </>
    );
}
