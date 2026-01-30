
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import BoutiqueInterface from "@/components/boutique/BoutiqueInterface";
import { getActiveBrands, getBoutiqueItems } from "@/app/actions/boutique";

export default async function BoutiquePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;

    // Fetch Data
    const [brandsRes, itemsRes] = await Promise.all([
        getActiveBrands(),
        getBoutiqueItems()
    ]);

    const brands = brandsRes.success ? brandsRes.brands || [] : [];
    const items = itemsRes.success ? itemsRes.items || [] : [];

    return (
        <main className="bg-[#E6DED6]/30 min-h-screen">
            {/* Header Area */}
            <div className="bg-[#E6DED6] pt-8 pb-12 px-6 border-b border-white/50">
                <div className="container mx-auto">
                    <Link href="/vault" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/60 hover:text-ac-olive transition-colors mb-6 group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Vault
                    </Link>
                    <div className="max-w-4xl">
                        <h1 className="font-serif text-5xl md:text-7xl text-ac-taupe mb-4">
                            The Boutique
                        </h1>
                        <p className="text-xl text-ac-coffee font-light max-w-2xl leading-relaxed">
                            A curated selection of the pieces that define the Alejandra Cuesta aesthetic.
                            Approved by the stylist, ready for your wardrobe.
                        </p>
                    </div>
                </div>
            </div>

            {/* Interactive Interface */}
            <BoutiqueInterface initialBrands={brands} initialItems={items} />
        </main>
    );
}
