"use client";

import { Instagram } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const TikTokIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        className={className}
    >
        <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
    </svg>
);

export default function Footer() {
    const t = useTranslations('Footer');

    return (
        <footer className="w-full bg-ac-taupe text-ac-sand py-8 px-4 md:px-12">
            <div className="container mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                    {/* Column 1: Brand */}
                    <div className="flex flex-col space-y-4">
                        <h2 className="font-serif text-3xl tracking-widest">{t('tagline')}</h2>
                        <p className="text-ac-sand/60 text-sm max-w-xs">
                            {t('subtagline')}
                        </p>
                    </div>

                    {/* Column 2: Quick Links */}
                    <div className="flex flex-col space-y-4">
                        <h3 className="text-sm uppercase tracking-widest text-ac-beige">{t('explore')}</h3>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="hover:text-ac-beige transition-colors">Home</a></li>
                            <li><a href="#" className="hover:text-ac-beige transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-ac-beige transition-colors">Services</a></li>
                            <li><a href="#" className="hover:text-ac-beige transition-colors">Journal</a></li>
                        </ul>
                    </div>

                    {/* Column 3: Locations */}
                    <div className="flex flex-col space-y-4">
                        <h3 className="text-sm uppercase tracking-widest text-ac-beige">{t('studios')}</h3>
                        <ul className="space-y-2 text-sm text-ac-sand/80">
                            <li>Miami</li>
                            <li>Bogotá</li>
                            <li>Madrid</li>
                        </ul>
                    </div>

                    {/* Column 4: Contact */}
                    <div className="flex flex-col space-y-4">
                        <h3 className="text-sm uppercase tracking-widest text-ac-beige">{t('connect')}</h3>
                        <a href="mailto:hello@theacstyle.com" className="text-lg font-serif hover:text-ac-beige transition-colors">
                            hello@theacstyle.com
                        </a>
                        <div className="flex space-x-4 pt-2">
                            <a href="https://www.instagram.com/ac.stylingcoach/" target="_blank" rel="noopener noreferrer" className="hover:text-ac-beige transition-colors"><Instagram size={20} /></a>
                            <a href="https://www.tiktok.com/@ac.styling" target="_blank" rel="noopener noreferrer" className="hover:text-ac-beige transition-colors"><TikTokIcon size={20} /></a>
                        </div>
                    </div>

                </div>

                {/* Copyright */}
                <div className="mt-8 border-t border-ac-sand/10 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-ac-sand/40">
                    <p>&copy; {new Date().getFullYear()} The AC Style. {t('rights')}</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <Link href="/legal/privacy" className="hover:text-ac-sand transition-colors">{t('privacy')}</Link>
                        <Link href="/legal/terms" className="hover:text-ac-sand transition-colors">{t('terms')}</Link>
                        <Link href="/legal/refunds" className="hover:text-ac-sand transition-colors">{t('refunds')}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
