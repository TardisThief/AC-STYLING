import { SkeletonCardGrid, SkeletonHeader, SkeletonScreen } from "@/components/ui/Skeleton";

/** Shaped like `foundations/page.tsx`: header, then the collections grid. */
export default function Loading() {
    return (
        <SkeletonScreen label="Loading foundations">
            <SkeletonHeader />
            <SkeletonCardGrid count={6} />
        </SkeletonScreen>
    );
}
