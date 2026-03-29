"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

export default function LanguageSwitcher({ isScrolled }: { isScrolled?: boolean }) {
    const locale = useLocale();
    const pathname = usePathname();

    const activeClass = isScrolled
        ? "text-ac-taupe font-bold border-b border-ac-taupe"
        : "text-ac-beige font-bold border-b border-ac-beige";

    const inactiveClass = isScrolled
        ? "text-ac-taupe/60 hover:text-ac-taupe"
        : "text-white/70 hover:text-white";

    const separatorClass = isScrolled ? "text-ac-taupe/40" : "text-white/50";

    return (
        <div className="flex gap-2 text-sm font-sans uppercase tracking-widest">
            <Link
                href={pathname}
                locale="en"
                className={`transition-colors duration-300 ${locale === "en" ? activeClass : inactiveClass}`}
            >
                EN
            </Link>
            <span className={separatorClass}>|</span>
            <Link
                href={pathname}
                locale="es"
                className={`transition-colors duration-300 ${locale === "es" ? activeClass : inactiveClass}`}
            >
                ES
            </Link>
        </div>
    );
}
