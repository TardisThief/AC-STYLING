"use client";

import { Printer, ArrowLeft } from "lucide-react";
import type { Profile } from "@/app/lib/types";
import Link from "next/link";
import { StyleEssentials } from "@/app/actions/vault/profile";
import { JourneyStats } from "@/app/actions/vault/journey";

interface StyleCardClientProps {
    profile: Profile;
    essence: StyleEssentials;
    journey: JourneyStats | null;
}

export default function StyleCardClient({ profile, essence, journey }: StyleCardClientProps) {
    const memberSince = journey?.memberSince
        ? new Date(journey.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : null;

    const words = essence.styleWords.length > 0 ? essence.styleWords.join(' · ') : "Your Style Essence";
    const archetype = essence.archetype.length > 0 ? essence.archetype.join(' + ') : null;

    return (
        <>
            {/* Screen-only nav bar */}
            <div className="print:hidden bg-white border-b border-ac-taupe/10 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
                <Link
                    href="/vault/profile"
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Profile
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 bg-ac-taupe text-white px-5 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-ac-taupe/90 transition-colors"
                >
                    <Printer size={14} />
                    Save as PDF
                </button>
            </div>

            {/* Print area */}
            <div
                id="style-card-print"
                className="
                    mx-auto max-w-2xl px-10 py-16
                    print:max-w-none print:px-14 print:py-14
                    print:w-[210mm] print:min-h-[297mm]
                    bg-white
                "
                style={{ fontFamily: "'Georgia', serif" }}
            >
                {/* Header */}
                <div className="border-b-2 border-[#3D3630] pb-8 mb-10">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#3D3630]/50 font-sans mb-3">
                        AC Styling · Confidential Style Card
                    </p>
                    <h1 className="text-5xl font-serif text-[#3D3630] leading-tight">
                        {profile.full_name || "Style Card"}
                    </h1>
                    {memberSince && (
                        <p className="text-sm text-[#3D3630]/50 font-sans mt-2">Member since {memberSince}</p>
                    )}
                </div>

                {/* Style Essence */}
                <section className="mb-10">
                    <h2 className="text-[9px] uppercase tracking-[0.25em] font-sans text-[#3D3630]/50 mb-4">Style Essence</h2>
                    {archetype && (
                        <p className="text-sm uppercase tracking-widest font-sans text-[#B8965A] mb-2">{archetype}</p>
                    )}
                    <p className="text-3xl font-serif text-[#3D3630] leading-snug">{words}</p>
                </section>

                {/* Power Features */}
                {essence.powerFeatures.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-[9px] uppercase tracking-[0.25em] font-sans text-[#3D3630]/50 mb-4">Power Features</h2>
                        <div className="space-y-2">
                            {essence.powerFeatures.map((f, i) => (
                                <div key={i} className="flex items-baseline gap-3">
                                    <span className="text-[9px] uppercase tracking-widest font-sans text-[#3D3630]/40 w-32 flex-shrink-0">{f.label}</span>
                                    <span className="text-lg font-serif text-[#3D3630]">{f.value}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Color Energy */}
                {essence.colorEnergy.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-[9px] uppercase tracking-[0.25em] font-sans text-[#3D3630]/50 mb-4">Color Energy</h2>
                        <div className="space-y-2">
                            {essence.colorEnergy.map((c, i) => (
                                <div key={i} className="flex items-baseline gap-3">
                                    <span className="text-[9px] uppercase tracking-widest font-sans text-[#3D3630]/40 w-32 flex-shrink-0">{c.label}</span>
                                    <span className="text-lg font-serif text-[#3D3630]">{c.value}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Journey Summary */}
                {journey && (
                    <section className="mb-10">
                        <h2 className="text-[9px] uppercase tracking-[0.25em] font-sans text-[#3D3630]/50 mb-4">Journey</h2>
                        <div className="flex flex-wrap gap-x-10 gap-y-3">
                            <div>
                                <span className="text-[9px] uppercase tracking-widest font-sans text-[#3D3630]/40 block">Masterclasses</span>
                                <span className="text-lg font-serif text-[#3D3630]">
                                    {journey.hasFullAccess ? 'Full Vault Access' : `${journey.masterclassesAccessCount} of ${journey.totalMasterclasses}`}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase tracking-widest font-sans text-[#3D3630]/40 block">Essence Labs</span>
                                <span className="text-lg font-serif text-[#3D3630]">{journey.essenceLabsCompleted} completed</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Footer */}
                <div className="border-t border-[#3D3630]/20 pt-6 mt-10 flex justify-between items-end">
                    <div>
                        <p className="text-[9px] uppercase tracking-widest font-sans text-[#3D3630]/40">AC Styling</p>
                        <p className="text-[9px] font-sans text-[#3D3630]/30">acstyling.com</p>
                    </div>
                    <p className="text-[9px] font-sans text-[#3D3630]/20">
                        Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #style-card-print, #style-card-print * { visibility: visible; }
                    #style-card-print { position: absolute; left: 0; top: 0; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </>
    );
}
