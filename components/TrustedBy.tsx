import { getTrustedByLogos } from '@/app/actions/admin/manage-boutique';
import TrustedByCarousel from './TrustedByCarousel';

const STATIC_FALLBACK = [12, 2, 5, 6, 8, 1, 3, 4, 7, 9, 10, 11].map((id) => ({
    id,
    src: `/partner ${id}.png`,
    alt: `Partner ${id}`,
}));

export default async function TrustedBy() {
    const res = await getTrustedByLogos();

    const logos =
        res.success && res.logos && res.logos.filter((l: any) => l.active).length > 0
            ? res.logos
                  .filter((l: any) => l.active)
                  .map((l: any) => ({ id: l.id, src: l.logo_url, alt: l.name }))
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
