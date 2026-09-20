/**
 * Loading placeholders.
 *
 * A skeleton is only worth more than a spinner if it has the shape of what is
 * coming — otherwise it is a spinner that takes up more room. These are the
 * pieces the Vault's `loading.tsx` files compose; each route matches its own
 * layout rather than sharing one generic block.
 *
 * `animate-pulse` is neutralized under `prefers-reduced-motion` by a rule in
 * globals.css, so a full page of pulsing blocks does not ship to someone who
 * has asked the OS for less motion.
 *
 * The whole tree is `aria-hidden` and the container carries the live region:
 * a screen reader should hear "loading" once, not read out two dozen empty
 * boxes.
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-ac-taupe/10 ${className}`} />;
}

/** A card with an image well and two lines of text under it. */
export function SkeletonCard() {
    return (
        <div aria-hidden="true" className="flex flex-col gap-3">
            <SkeletonBlock className="aspect-[4/3] w-full" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
        </div>
    );
}

/** A responsive grid of cards, matching the catalogue pages' three columns. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
    return (
        <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: count }, (_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

/** The page title block the Vault's inner pages all open with. */
export function SkeletonHeader() {
    return (
        <div aria-hidden="true" className="mb-8">
            <SkeletonBlock className="h-3 w-24 mb-4" />
            <SkeletonBlock className="h-10 w-2/3 max-w-md mb-3" />
            <SkeletonBlock className="h-3 w-1/3 max-w-xs" />
        </div>
    );
}

/**
 * Wraps a skeleton so assistive technology is told the page is busy without
 * having to describe the placeholder itself.
 */
export function SkeletonScreen({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}
