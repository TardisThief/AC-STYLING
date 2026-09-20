import { SkeletonCardGrid, SkeletonHeader, SkeletonScreen } from "@/components/ui/Skeleton";

/** Shaped like `boutique/page.tsx`: header, then the product grid. */
export default function Loading() {
    return (
        <SkeletonScreen label="Loading the boutique">
            <SkeletonHeader />
            <SkeletonCardGrid count={9} />
        </SkeletonScreen>
    );
}
