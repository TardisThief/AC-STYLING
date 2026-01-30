import Link from 'next/link';
import { Play, ArrowRight } from 'lucide-react';

export default async function GalleryPage() {
    // Map of product IDs to real content
    // Showing a preview of the Masterclasses (Sample of 3)
    const MASTERCLASSES = [
        { id: 'style-audit', title: "The Wardrobe Audit", subtitle: "Foundation No. 1", videoId: "76979871" },
        { id: 'foundations', title: "Color Theory & You", subtitle: "Foundation No. 2", videoId: "76979871" },
        { id: 'silhouette', title: "Silhouettes & Shape", subtitle: "Foundation No. 3", videoId: "76979871" },
    ];

    // ANSWER TO QUESTION:
    // This page is configured as a PUBLIC route in middleware.ts (lines 53-54), 
    // so it DOES NOT require user access. It works as a landing page.

    return (
        <div className="min-h-screen text-[#3D3630] -mt-24 pt-24">
            {/* Custom Header for Gallery Mode */}
            <div className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-50 bg-[#E6DED6]/80 backdrop-blur-sm pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <span className="font-serif text-xl tracking-tighter">AC STYLING</span>
                </div>
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Link href="/vault" className="text-[10px] uppercase tracking-widest text-[#3D3630]/60 hover:text-[#3D3630]">Dashboard</Link>
                    <div className="bg-[#3D3630] text-[#E6DED6] px-3 py-1 text-[10px] font-bold uppercase rounded-full">
                        Vault Access
                    </div>
                </div>
            </div>

            <section className="pt-12 pb-20 max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row gap-12 mb-24">
                    {/* Left: Text Content */}
                    <div className="lg:w-1/2 flex flex-col justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#C5A059] mb-4">The Methodology</span>
                        <h1 className="font-serif text-5xl md:text-6xl mb-6 leading-[0.9] text-[#3D3630]">
                            Style is a Language. <br /><span className="italic opacity-80">Learn to Speak It.</span>
                        </h1>
                        <div className="text-[#3D3630]/70 text-lg font-light leading-relaxed mb-8 max-w-md">
                            Join Alejandra Carrillo in this exclusive masterclass series. Move beyond trends and discover the timeless architectural principles of personal style.
                        </div>
                        <div className="flex gap-4">
                            <Link
                                href="/vault"
                                className="inline-flex items-center gap-2 bg-[#3D3630] text-[#E6DED6] px-6 py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-[#3D3630]/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                                <ArrowRight size={14} />
                                Go to Dashboard
                            </Link>
                        </div>
                    </div>

                    {/* Right: Vimeo Player (Intro - Free) */}
                    <div className="lg:w-1/2 relative">
                        <div className="aspect-video w-full bg-black/5 overflow-hidden rounded-sm border border-[#3D3630]/10 relative shadow-2xl">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-[#C5A059]/20 to-transparent opacity-50 blur-xl"></div>
                            <iframe
                                src="https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0&autopause=0&player_id=0&app_id=58479"
                                className="absolute top-0 left-0 w-full h-full relative z-10"
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                                title="Alejandra Carrillo Intro"
                            ></iframe>
                        </div>
                    </div>
                </div>

                {/* The Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {MASTERCLASSES.map((item) => (
                        <Link
                            key={item.id}
                            href={`/vault/foundations/${item.id}`}
                            className="group relative aspect-[3/4] overflow-hidden bg-[#3D3630]/5 border border-[#3D3630]/5 flex flex-col cursor-pointer"
                        >
                            {/* Thumbnail Area */}
                            <div className="flex-1 relative overflow-hidden">
                                <div className="absolute inset-0 bg-neutral-300 transition-transform duration-700 group-hover:scale-105"></div> {/* Placeholder Image */}

                                {/* Overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/20 hover:bg-black/10 transition-colors duration-500">
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110 bg-[#C5A059] text-white">
                                        <Play fill="currentColor" size={16} />
                                    </div>

                                    <span className="text-[10px] uppercase tracking-widest text-white/90 drop-shadow-md font-bold mb-2">{item.subtitle}</span>
                                    <h3 className="font-serif text-2xl text-white drop-shadow-md">{item.title}</h3>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
