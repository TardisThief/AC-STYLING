/**
 * The colour spine: the page's through-line and the ladder's progress bar.
 *
 * It enters the hero nearly desaturated and gains saturation and height at each
 * rung as the reader moves from recognising her problem to being able to place
 * herself. Level 4 returns it to a hairline once the argument is made and the
 * page turns commercial. The reader's growing clarity and the graphic's growing
 * resolution are meant to be the same movement.
 *
 * Purely decorative, so it is hidden from assistive tech — the copy it
 * accompanies carries the meaning on its own.
 */

const LEVELS = {
    1: { h: "h-[3px]", opacity: "opacity-25", sat: "saturate-[0.35]" },
    2: { h: "h-[5px]", opacity: "opacity-50", sat: "saturate-[0.6]" },
    3: { h: "h-[7px]", opacity: "opacity-80", sat: "saturate-100" },
    4: { h: "h-[3px]", opacity: "opacity-30", sat: "saturate-[0.4]" },
} as const;

export default function Spine({ level }: { level: 1 | 2 | 3 | 4 }) {
    const { h, opacity, sat } = LEVELS[level];
    return (
        <div
            aria-hidden="true"
            className={`w-full ${h} ${opacity} ${sat}`}
            style={{
                background:
                    "linear-gradient(90deg, #D8B65C 0%, #C4923F 22%, #A96A3E 44%, #6E6A82 68%, #9FB0BE 86%, #4A4A6A 100%)",
            }}
        />
    );
}
