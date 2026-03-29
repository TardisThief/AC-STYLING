
"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { PartnerBrand, BoutiqueItem } from "@/app/actions/boutique";
import BrandAtelier from "./BrandAtelier";
import ProductGrid from "./ProductGrid";

interface Collection {
    id: string;
    title: string;
    title_es: string | null;
    cover_image_url: string | null;
    items: { item_id: string }[];
}

interface BoutiqueInterfaceProps {
    initialBrands: PartnerBrand[];
    initialItems: BoutiqueItem[];
    initialCollections: Collection[];
    locale: string;
    initialSavedIds: string[];
}

export default function BoutiqueInterface({
    initialBrands,
    initialItems,
    initialCollections,
    locale,
    initialSavedIds,
}: BoutiqueInterfaceProps) {
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [showSavedOnly, setShowSavedOnly] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));

    const handleSaveToggle = (itemId: string, isSaved: boolean) => {
        setSavedIds(prev => {
            const next = new Set(prev);
            isSaved ? next.add(itemId) : next.delete(itemId);
            return next;
        });
    };

    // Apply brand filter
    const brandFiltered = selectedBrandId
        ? initialItems.filter(item => item.brand_id === selectedBrandId)
        : initialItems;

    // Apply collection filter
    const collectionFiltered = selectedCollectionId
        ? (() => {
            const col = initialCollections.find(c => c.id === selectedCollectionId);
            if (!col) return brandFiltered;
            const ids = new Set(col.items.map(i => i.item_id));
            return brandFiltered.filter(item => ids.has(item.id));
        })()
        : brandFiltered;

    // Apply saves filter
    const filteredItems = showSavedOnly
        ? collectionFiltered.filter(item => savedIds.has(item.id))
        : collectionFiltered;

    const handleSelectBrand = (id: string | null) => {
        setSelectedBrandId(id);
        setSelectedCollectionId(null);
        setShowSavedOnly(false);
    };

    const handleSelectCollection = (id: string) => {
        setSelectedCollectionId(prev => (prev === id ? null : id));
        setSelectedBrandId(null);
        setShowSavedOnly(false);
    };

    const handleShowSaved = () => {
        setShowSavedOnly(prev => !prev);
        setSelectedBrandId(null);
        setSelectedCollectionId(null);
    };

    return (
        <section className="min-h-screen pb-20">
            {/* 1. Brand Filter Bar */}
            <BrandAtelier
                brands={initialBrands}
                selectedBrandId={selectedBrandId}
                onSelectBrand={handleSelectBrand}
            />

            {/* 2. Collections + Saves Filter Row */}
            {(initialCollections.length > 0 || savedIds.size > 0) && (
                <div className="border-b border-ac-taupe/10 bg-white/30">
                    <div className="container mx-auto px-6 py-3 flex items-center gap-3 overflow-x-auto">
                        {initialCollections.length > 0 && (
                            <span className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold flex-shrink-0 mr-1">
                                Collections
                            </span>
                        )}
                        {initialCollections.map(col => {
                            const title = locale === 'es' && col.title_es ? col.title_es : col.title;
                            const active = selectedCollectionId === col.id;
                            return (
                                <button
                                    key={col.id}
                                    onClick={() => handleSelectCollection(col.id)}
                                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                                        active
                                            ? 'bg-ac-taupe text-white border-ac-taupe'
                                            : 'border-ac-taupe/20 text-ac-taupe/60 hover:border-ac-taupe/60 hover:text-ac-taupe'
                                    }`}
                                >
                                    {title}
                                </button>
                            );
                        })}

                        {/* Separator */}
                        {initialCollections.length > 0 && savedIds.size > 0 && (
                            <div className="h-4 w-px bg-ac-taupe/20 flex-shrink-0 mx-1" />
                        )}

                        {/* Saved filter chip */}
                        {savedIds.size > 0 && (
                            <button
                                onClick={handleShowSaved}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                                    showSavedOnly
                                        ? 'bg-ac-gold text-white border-ac-gold'
                                        : 'border-ac-taupe/20 text-ac-taupe/60 hover:border-ac-gold/60 hover:text-ac-gold'
                                }`}
                            >
                                <Bookmark size={11} />
                                Saved ({savedIds.size})
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Product Grid */}
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

                <ProductGrid
                    items={filteredItems}
                    locale={locale}
                    savedIds={savedIds}
                    onSaveToggle={handleSaveToggle}
                />
            </div>
        </section>
    );
}
