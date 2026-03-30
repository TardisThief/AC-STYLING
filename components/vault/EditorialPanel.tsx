
"use client";

import { Link } from "@/i18n/routing";
import { Calendar, ChevronRight, Play } from "lucide-react";
import { EditorialContent } from "@/app/actions/dashboard";

interface EditorialPanelProps {
    editorial: EditorialContent;
}

// ── Placeholder tile (used when styleOfWeek or alesPick is null) ─────────────
function Placeholder({ label }: { label: string }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-ac-taupe/20 bg-ac-taupe/[0.03] min-h-0">
            <span className="text-[8px] uppercase tracking-widest font-bold text-ac-taupe/30">{label}</span>
            <span className="text-[10px] text-ac-taupe/20">Coming soon</span>
        </div>
    );
}

// ── New-user welcome fallback (left panel when no progress) ──────────────────
function WelcomePanel() {
    const sections = [
        { label: "Masterclasses", desc: "Your complete style education — start here." },
        { label: "Courses", desc: "Focused lessons on specific style topics." },
        { label: "The Studio", desc: "Book a 1-on-1 session with Ale." },
        { label: "The Boutique", desc: "Curated pieces Ale hand-picks for you." },
        { label: "Ask Ale", desc: "Send her a direct question, anytime." },
    ];

    return (
        <div className="md:col-span-3 relative rounded-sm overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop"
                alt="Welcome"
                className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/95 via-ac-taupe/70 to-ac-taupe/20" />

            <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                <span className="text-[9px] uppercase tracking-widest font-bold text-ac-gold mb-2 block">
                    Welcome to the Lab
                </span>
                <h2 className="font-serif text-2xl md:text-3xl text-white leading-tight mb-5">
                    Your style universe starts here.
                </h2>

                {/* Quick-link guide */}
                <ul className="space-y-2 mb-6">
                    {sections.map(s => (
                        <li key={s.label} className="flex gap-2 items-baseline">
                            <span className="text-ac-gold text-[9px] font-bold uppercase tracking-widest flex-shrink-0 w-24">
                                {s.label}
                            </span>
                            <span className="text-white/60 text-[11px] leading-snug">{s.desc}</span>
                        </li>
                    ))}
                </ul>

                <Link
                    href="/vault/foundations"
                    className="self-start flex items-center gap-2 px-5 py-2.5 bg-white/15 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-white/25 transition-all"
                >
                    <Play size={9} className="fill-white" />
                    Begin Masterclasses
                </Link>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EditorialPanel({ editorial }: EditorialPanelProps) {
    const { continueCourse, styleOfWeek, alesPick } = editorial;

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-[320px] md:h-[380px]">

            {/* ── LEFT: Learning or Welcome ──────────────────────────────── */}
            {continueCourse ? (
                <div className="md:col-span-3 relative rounded-sm overflow-hidden group">
                    <img
                        src={continueCourse.imageUrl}
                        alt={continueCourse.masterclassTitle}
                        className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ac-taupe/90 via-ac-taupe/50 to-ac-taupe/10" />

                    <div className="absolute inset-0 p-5 md:p-7 flex flex-col justify-end">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-ac-gold mb-2 block">
                            Ale&apos;s Pick for You
                        </span>
                        <h2 className="font-serif text-2xl md:text-3xl text-white leading-tight mb-1">
                            {continueCourse.masterclassTitle}
                        </h2>
                        <p className="text-white/60 text-xs mb-4">{continueCourse.chapterTitle}</p>

                        {/* Progress bar */}
                        <div className="mb-5">
                            <div className="flex justify-between mb-1.5">
                                <span className="text-white/40 text-[9px] uppercase tracking-wider">Progress</span>
                                <span className="text-white/40 text-[9px]">
                                    {continueCourse.chapterNum} / {continueCourse.totalChapters} chapters
                                </span>
                            </div>
                            <div className="h-[2px] w-full bg-white/15 rounded-full">
                                <div
                                    className="h-full bg-ac-gold rounded-full transition-all duration-700"
                                    style={{ width: `${continueCourse.progressPct}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Link
                                href={continueCourse.href}
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
            ) : (
                <WelcomePanel />
            )}

            {/* ── RIGHT: Style of the Week + Ale's Pick ─────────────────── */}
            <div className="md:col-span-2 flex flex-col gap-3">

                {/* Style of the Week */}
                {styleOfWeek ? (
                    <Link href={styleOfWeek.href} className="flex-1 relative rounded-sm overflow-hidden group block min-h-0">
                        <img
                            src={styleOfWeek.coverImageUrl}
                            alt={styleOfWeek.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                            <span className="text-[8px] uppercase tracking-widest font-bold text-ac-gold block mb-0.5">
                                Style of the Week
                            </span>
                            <p className="font-serif text-base text-white leading-tight">{styleOfWeek.title}</p>
                        </div>
                    </Link>
                ) : (
                    <Placeholder label="Style of the Week" />
                )}

                {/* Ale's Pick */}
                {alesPick ? (
                    <Link
                        href={alesPick.href}
                        className="flex gap-3 p-3 bg-white/50 backdrop-blur-sm border border-white/40 rounded-sm hover:bg-white/70 transition-all group"
                    >
                        <div className="w-14 h-14 flex-shrink-0 relative overflow-hidden rounded-sm">
                            <img
                                src={alesPick.imageUrl}
                                alt={alesPick.itemName}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <span className="text-[8px] uppercase tracking-widest font-bold text-ac-gold mb-0.5">
                                Ale&apos;s Pick
                            </span>
                            <p className="font-serif text-sm text-ac-taupe leading-tight truncate">{alesPick.itemName}</p>
                            <span className="text-ac-taupe/50 text-[10px] mt-0.5">{alesPick.brandName}</span>
                        </div>
                        <ChevronRight size={14} className="ml-auto self-center flex-shrink-0 text-ac-taupe/30 group-hover:text-ac-gold transition-colors" />
                    </Link>
                ) : (
                    <div className="flex gap-3 p-3 bg-white/30 border border-dashed border-ac-taupe/20 rounded-sm">
                        <div className="w-14 h-14 flex-shrink-0 rounded-sm bg-ac-taupe/[0.06]" />
                        <div className="flex flex-col justify-center gap-1.5">
                            <span className="text-[8px] uppercase tracking-widest font-bold text-ac-taupe/25">Ale&apos;s Pick</span>
                            <div className="h-2 w-24 bg-ac-taupe/10 rounded-full" />
                            <div className="h-1.5 w-16 bg-ac-taupe/10 rounded-full" />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
