import { getPublicTrustedByLogos } from '@/app/lib/trusted-by';
import TrustedByCarousel from './TrustedByCarousel';

const STATIC_FALLBACK = [12, 2, 5, 6, 8, 1, 3, 4, 7, 9, 10, 11].map((id) => ({
    id,
    src: `/partner ${id}.png`,
    alt: `Partner ${id}`,
}));

export default async function TrustedBy() {
    // Cached + cookieless: this read is what kept the landing page dynamic.
    const rows = await getPublicTrustedByLogos();

    const logos =
        rows.length > 0
            ? rows.map((l) => ({ id: l.id, src: l.logo_url, alt: l.name }))
            : STATIC_FALLBACK;

    return (
        <section className="w-full py-12 md:py-16 bg-white overflow-hidden">
            <div className="container-fluid">
                <h3 className="text-center text-sm font-medium tracking-[0.2em] text-gray-500 mb-8 md:mb-12 uppercase">
                    Trusted By
                </h3>
                <TrustedByCarousel logos={logos} />
            </div>
        </section>
    );
}
