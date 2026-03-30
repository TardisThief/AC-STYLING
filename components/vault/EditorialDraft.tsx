
// DRAFT / MOCKUP — static placeholder data
// Review locally, then replace mock data with real props before shipping

"use client";

import { Link } from "@/i18n/routing";
import { Calendar, ChevronRight, Play } from "lucide-react";

export default function EditorialDraft() {

    // ── MOCK DATA ─────────────────────────────────────────────────────────────
    // These will eventually come from the same pulse/dashboard server action
    const course = {
        title: "Dopamine Dressing",
        chapter: "Ch. 3 — Color Theory in Practice",
        progress: 37,
        chaptersComplete: 3,
        totalChapters: 8,
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2070&auto=format&fit=crop",
        href: "/vault/courses",
    };

    const styleOfWeek = {
        label: "Style of the Week",
        title: "Quiet Luxury",
        subtitle: "Tonal neutrals, clean structure",
        imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1020&auto=format&fit=crop",
        href: "/vault/boutique",
    };

    const boutiqueRec = {
        label: "Ale's Pick",
        title: "The Oversized Linen Blazer",
        price: "$285",
        imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=600&auto=format&fit=crop",
        href: "/vault/boutique",
    };
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-[320px] md:h-[380px]">

            {/* ── LEFT: Learning Panel (3/5) ─────────────────────────────────── */}
            <div className="md:col-span-3 relative rounded-sm overflow-hidden group">
                {/* Background */}
                <img
                    src={course.imageUrl}
                    alt={course.title}
                    className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/90 via-ac-taupe/50 to-ac-taupe/10" />

                {/* Content pinned to bottom */}
                <div className="absolute inset-0 p-5 md:p-7 flex flex-col justify-end">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-ac-gold mb-2 block">
                        Ale&apos;s Pick for You
                    </span>
                    <h2 className="font-serif text-2xl md:text-3xl text-white leading-tight mb-1">
                        {course.title}
                    </h2>
                    <p className="text-white/60 text-xs mb-4">{course.chapter}</p>

                    {/* Progress bar */}
                    <div className="mb-5">
                        <div className="flex justify-between mb-1.5">
                            <span className="text-white/40 text-[9px] uppercase tracking-wider">Progress</span>
                            <span className="text-white/40 text-[9px]">
                                {course.chaptersComplete} / {course.totalChapters} chapters
                            </span>
                        </div>
                        <div className="h-[2px] w-full bg-white/15 rounded-full">
                            <div
                                className="h-full bg-ac-gold rounded-full"
                                style={{ width: `${course.progress}%` }}
                            />
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex gap-3">
                        <Link
                            href={course.href}
                            className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-white/25 transition-all"
                        >
                            <Play size={9} className="fill-white" />
                            Continue
                        </Link>
                        <Link
                            href="/vault/services"
                            className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white/70 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:border-white/40 hover:text-white transition-all"
                        >
                            <Calendar size={9} />
                            Book a Session
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Personalized Feed (2/5) ────────────────────────────── */}
            <div className="md:col-span-2 flex flex-col gap-3">

                {/* Style of the Week */}
                <Link href={styleOfWeek.href} className="flex-1 relative rounded-sm overflow-hidden group block min-h-0">
                    <img
                        src={styleOfWeek.imageUrl}
                        alt={styleOfWeek.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-[8px] uppercase tracking-widest font-bold text-ac-gold block mb-0.5">
                            {styleOfWeek.label}
                        </span>
                        <p className="font-serif text-base text-white leading-tight">{styleOfWeek.title}</p>
                        <p className="text-white/55 text-[10px]">{styleOfWeek.subtitle}</p>
                    </div>
                </Link>

                {/* Boutique Recommendation */}
                <Link
                    href={boutiqueRec.href}
                    className="flex gap-3 p-3 bg-white/50 backdrop-blur-sm border border-white/40 rounded-sm hover:bg-white/70 transition-all group"
                >
                    <div className="w-14 h-14 flex-shrink-0 relative overflow-hidden rounded-sm">
                        <img
                            src={boutiqueRec.imageUrl}
                            alt={boutiqueRec.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <span className="text-[8px] uppercase tracking-widest font-bold text-ac-gold mb-0.5">
                            {boutiqueRec.label}
                        </span>
                        <p className="font-serif text-sm text-ac-taupe leading-tight truncate">{boutiqueRec.title}</p>
                        <span className="text-ac-taupe/50 text-xs mt-0.5">{boutiqueRec.price}</span>
                    </div>
                    <ChevronRight size={14} className="ml-auto self-center flex-shrink-0 text-ac-taupe/30 group-hover:text-ac-gold transition-colors" />
                </Link>

            </div>
        </div>
    );
}
