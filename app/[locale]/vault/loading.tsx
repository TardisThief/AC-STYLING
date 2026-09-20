import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * Fallback for the Vault dashboard, and for any `/vault/*` route that does not
 * define a closer one. Shaped like `vault/page.tsx`: a greeting line, then the
 * three-column content area with the quick-actions sidebar.
 *
 * It renders inside `vault/layout.tsx`, so the concierge navbar stays put and
 * only the content area is replaced — the member never loses their navigation
 * while a page loads.
 */
export default function Loading() {
    return (
        <SkeletonScreen label="Loading your Vault">
            <div className="flex flex-col gap-4">
                <div className="pt-2">
                    <SkeletonBlock className="h-9 w-72 max-w-full" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                    <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col gap-4">
                        <SkeletonBlock className="h-64 w-full" />
                        <SkeletonBlock className="h-24 w-full" />
                    </div>
                    <div className="lg:col-span-1 order-1 lg:order-2 flex flex-col gap-3">
                        <SkeletonBlock className="h-12 w-full" />
                        <SkeletonBlock className="h-12 w-full" />
                        <SkeletonBlock className="h-12 w-full" />
                    </div>
                </div>
            </div>
        </SkeletonScreen>
    );
}
