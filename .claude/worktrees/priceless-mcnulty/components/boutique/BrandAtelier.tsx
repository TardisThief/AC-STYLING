
"use client";

import { motion } from "framer-motion";
import { PartnerBrand } from "@/app/actions/boutique";
import { LayoutGrid } from "lucide-react";

interface BrandAtelierProps {
    brands: PartnerBrand[];
    selectedBrandId: string | null;
    onSelectBrand: (id: string | null) => void;
}

export default function BrandAtelier({ brands, selectedBrandId, onSelectBrand }: BrandAtelierProps) {
    return (
        <div className="w-full bg-white/20 backdrop-blur-md border-y border-ac-taupe/10 py-6 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="flex items-center gap-8 overflow-x-auto pb-4 no-scrollbar">
                    {/* All Brands Button */}
                    <button
                        onClick={() => onSelectBrand(null)}
                        className={`flex flex-col items-center gap-2 group min-w-[80px] transition-all duration-300 ${!selectedBrandId ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all duration-300 ${!selectedBrandId ? 'bg-ac-taupe text-white border-ac-taupe' : 'bg-white border-ac-taupe/20 group-hover:border-ac-taupe/40'
                            }`}>
                            <LayoutGrid size={24} />
                        </div>
                        <span className="text-xs uppercase tracking-widest font-sans text-ac-taupe">All Brands</span>
                    </button>

                    {/* Brand Logos */}
                    {brands.map((brand) => (
                        <button
                            key={brand.id}
                            onClick={() => onSelectBrand(brand.id)}
                            className={`flex flex-col items-center gap-2 group min-w-[100px] transition-all duration-300 ${selectedBrandId === brand.id ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-100'
                                }`}
                        >
                            <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center border transition-all duration-300 overflow-hidden p-2 ${selectedBrandId === brand.id ? 'border-ac-gold shadow-md' : 'border-ac-taupe/10 group-hover:border-ac-taupe/30'
                                }`}>
                                {brand.logo_url ? (
                                    <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500" />
                                ) : (
                                    <span className="text-xs font-serif text-center leading-none">{brand.name}</span>
                                )}
                            </div>
                            <span className="text-[10px] uppercase tracking-widest font-sans text-ac-taupe truncate max-w-[100px]">
                                {brand.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
