"use client";

import Script from "next/script";
import Footer from "@/components/Footer";
import { useTranslations } from "next-intl";

export default function BookPage() {
    const t = useTranslations('Services'); // reusing services translations for now, or just hardcode/generic

    return (
        <main className="flex min-h-screen flex-col items-center justify-between bg-ac-sand">
            <div className="w-full flex-grow flex flex-col items-center justify-center py-24 md:py-32 px-4">
                <div className="w-full max-w-4xl bg-white/50 backdrop-blur-sm rounded-xl shadow-lg border border-ac-taupe/10 p-4 md:p-8">
                    {/* Calendly Inline Widget */}
                    <div
                        className="calendly-inline-widget w-full"
                        data-url="https://calendly.com/fashionstylist-ac/30min"
                        style={{ minWidth: "320px", height: "700px" }}
                    />
                    <Script
                        type="text/javascript"
                        src="https://assets.calendly.com/assets/external/widget.js"
                        async
                    />
                </div>
            </div>
            <Footer />
        </main>
    );
}
