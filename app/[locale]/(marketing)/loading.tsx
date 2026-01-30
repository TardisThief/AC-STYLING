export default function Loading() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-ac-cream">
            <div className="relative w-24 h-24">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-ac-taupe/20 rounded-full animate-pulse"></div>
                <div className="absolute top-0 left-0 w-full h-full border-t-4 border-ac-taupe rounded-full animate-spin"></div>
            </div>
        </div>
    )
}
