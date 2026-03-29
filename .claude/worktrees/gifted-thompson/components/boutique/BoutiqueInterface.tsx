
"use client";

import { useState } from "react";
import { PartnerBrand, BoutiqueItem } from "@/app/actions/boutique";
import BrandAtelier from "./BrandAtelier";
import ProductGrid from "./ProductGrid";

interface BoutiqueInterfaceProps {
    initialBrands: PartnerBrand[];
    initialItems: BoutiqueItem[];
}

export default function BoutiqueInterface({ initialBrands, initialItems }: BoutiqueInterfaceProps) {
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

    // Client-side filtering for instant feedback
    const filteredItems = selectedBrandId
        ? initialItems.filter(item => item.brand_id === selectedBrandId)
        : initialItems;

    return (
        <section className="min-h-screen pb-20">
            {/* 1. The Brand Atelier (Filter Bar) */}
            <BrandAtelier
                brands={initialBrands}
                selectedBrandId={selectedBrandId}
                onSelectBrand={setSelectedBrandId}
            />

            {/* 2. The Curated Edit (Grid) */}
            <div className="container mx-auto px-6 py-12">
                <div className="flex justify-between items-end mb-8 border-b border-ac-taupe/10 pb-4">
                    <div>
                        <h2 className="font-serif text-3xl md:text-4xl text-ac-taupe mb-2">The Curated Edit</h2>
                        <p className="text-ac-taupe/60 italic font-serif">Hand-picked essentials for your capsule.</p>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-ac-taupe/40 font-bold">
                        {filteredItems.length} Items Found
                    </span>
                </div>

                <ProductGrid items={filteredItems} />
            </div>
        </section>
    );
}
