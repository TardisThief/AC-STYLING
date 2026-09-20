import { SkeletonBlock, SkeletonCardGrid, SkeletonHeader, SkeletonScreen } from "@/components/ui/Skeleton";

/** Shaped like `courses/page.tsx`: header, the course-pass banner, then the grid. */
export default function Loading() {
    return (
        <SkeletonScreen label="Loading courses">
            <SkeletonHeader />
            <SkeletonBlock className="h-20 w-full mb-8" />
            <SkeletonCardGrid count={6} />
        </SkeletonScreen>
    );
}
