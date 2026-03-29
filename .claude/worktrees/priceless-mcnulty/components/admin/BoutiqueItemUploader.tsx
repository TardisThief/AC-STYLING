"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, Image as ImageIcon, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { getSignedBoutiqueUploadUrl, createBoutiqueItemsBatch, type BoutiqueItemPayload } from "@/app/actions/admin/manage-boutique-upload";

interface Brand {
    id: string;
    name: string;
}

interface BoutiqueItemUploaderProps {
    brands: Brand[];
    onSuccess: () => void;
    onCancel: () => void;
}

interface StagedItem {
    id: string; // Temp ID for React keys
    file: File;
    preview: string;
    name: string;
    category: string;
    curator_note: string;
    affiliate_url_usa: string;
    affiliate_url_es: string;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    publicUrl?: string; // Set after upload
}

const CATEGORIES = [
    'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags', 'Beauty', 'Misc'
];

export default function BoutiqueItemUploader({ brands, onSuccess, onCancel }: BoutiqueItemUploaderProps) {
    const [selectedBrandId, setSelectedBrandId] = useState<string>("");
    const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    // 1. Context Selector
    const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedBrandId(e.target.value);
    };

    // 2. Drop Zone Logic
    const handleFilesSelected = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newItems: StagedItem[] = Array.from(files).map(file => ({
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file),
            name: file.name.split('.')[0].replace(/-/g, ' '), // Auto-fill name from filename
            category: 'Tops', // Default
            curator_note: '',
            affiliate_url_usa: '',
            affiliate_url_es: '',
            status: 'pending'
        }));

        setStagedItems(prev => [...prev, ...newItems]);
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelected(e.dataTransfer.files);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // 3. Staging Grid Logic
    const updateItem = (id: string, updates: Partial<StagedItem>) => {
        setStagedItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const removeItem = (id: string) => {
        setStagedItems(prev => {
            const item = prev.find(i => i.id === id);
            if (item) URL.revokeObjectURL(item.preview);
            return prev.filter(i => i.id !== id);
        });
    };

    const applyCategoryToAll = (category: string) => {
        setStagedItems(prev => prev.map(item => ({ ...item, category })));
        toast.info(`Applied "${category}" to all items`);
    };

    // 4. Publish Logic
    const handlePublish = async () => {
        if (!selectedBrandId) {
            toast.error("Please select a brand first");
            return;
        }

        if (stagedItems.length === 0) {
            toast.error("No items to publish");
            return;
        }

        setIsPublishing(true);
        let successCount = 0;
        const itemsToCreate: BoutiqueItemPayload[] = [];

        // Step A: Upload Files individually (concurrently or sequentially)
        // We'll do sequential to keep it simple and reliable for now, or parallel with limits if needed.
        // For "high speed", let's try parallel uploads.

        const uploadPromises = stagedItems.map(async (item) => {
            if (item.status === 'complete' && item.publicUrl) return item; // Already uploaded? (Future proofing)

            updateItem(item.id, { status: 'uploading' });

            try {
                // Get signed URL
                const { signedUrl, filePath, publicUrl, error } = await getSignedBoutiqueUploadUrl(item.file.name, item.file.type);

                if (error || !signedUrl || !publicUrl) throw new Error(error || "Failed to get upload URL");

                // Direct upload
                const uploadRes = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': item.file.type },
                    body: item.file
                });

                if (!uploadRes.ok) throw new Error("Upload failed");

                // Update item with public URL
                updateItem(item.id, { status: 'complete', publicUrl });
                return { ...item, publicUrl, status: 'complete' as const };
            } catch (err) {
                console.error(`Failed to upload ${item.name}`, err);
                updateItem(item.id, { status: 'error' });
                return { ...item, status: 'error' as const };
            }
        });

        const uploadedItems = await Promise.all(uploadPromises);

        // Step B: Collect valid items for DB insertion
        const validItems = uploadedItems.filter(i => i.status === 'complete' && i.publicUrl);

        if (validItems.length === 0) {
            setIsPublishing(false);
            toast.error("Failed to upload any images");
            return;
        }

        const payload: BoutiqueItemPayload[] = validItems.map((item: any) => ({
            brand_id: selectedBrandId,
            name: item.name,
            image_url: item.publicUrl,
            category: item.category,
            curator_note: item.curator_note,
            affiliate_url_usa: item.affiliate_url_usa,
            affiliate_url_es: item.affiliate_url_es,
            active: true
        }));

        // Step C: Batch Insert
        const dbRes = await createBoutiqueItemsBatch(payload);

        if (dbRes.success) {
            toast.success(`Published ${dbRes.count} items to Boutique!`);
            onSuccess(); // Triggers reload in parent
            setStagedItems([]); // Clear grid
        } else {
            toast.error(dbRes.error || "Failed to save items to database");
        }

        setIsPublishing(false);
    };

    return (
        <div className="space-y-6">
            {/* Header / Context Selector */}
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white/40 p-4 rounded-sm border border-ac-taupe/10">
                <div className="w-full md:w-1/3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">
                        Select Brand <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={selectedBrandId}
                        onChange={handleBrandChange}
                        className="w-full bg-white border border-ac-taupe/20 rounded-sm p-2 focus:outline-none focus:border-ac-gold"
                    >
                        <option value="">-- Choose Brand --</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-ac-taupe/60 hover:text-ac-taupe"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing || stagedItems.length === 0 || !selectedBrandId}
                        className="bg-ac-taupe text-white px-6 py-2 rounded-sm hover:bg-ac-taupe/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm tracking-wide"
                    >
                        {isPublishing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                        {isPublishing ? 'Publishing...' : 'Publish to Boutique'}
                    </button>
                </div>
            </div>

            {/* Drop Zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-ac-taupe/20 rounded-sm p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/40 hover:border-ac-taupe/40 transition-colors bg-ac-taupe/5"
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    accept="image/*"
                    multiple
                    className="hidden"
                />
                <div className="bg-white p-3 rounded-full mb-3 shadow-sm">
                    <Plus className="text-ac-gold" size={24} />
                </div>
                <h3 className="font-serif text-lg text-ac-taupe mb-1">Drag & Drop Products Here</h3>
                <p className="text-xs text-ac-taupe/60 uppercase tracking-widest">
                    Or click to browse • Supports multiple files
                </p>
            </div>

            {/* Staging Grid */}
            {stagedItems.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-ac-taupe/10 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-ac-taupe/40">
                            {stagedItems.length} Items Staged
                        </span>
                        {/* Bulk Action Example */}
                        {stagedItems.map(i => i.category).every((val, i, arr) => val === arr[0]) ? null : (
                            // Only show if mixed categories, or just always show for convenience
                            <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-ac-taupe/40 uppercase">Apply to all:</span>
                                {['Tops', 'Shoes', 'Accessories'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => applyCategoryToAll(cat)}
                                        className="text-[10px] border border-ac-taupe/10 px-2 py-1 rounded-sm hover:bg-ac-taupe hover:text-white transition-colors"
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stagedItems.map((item) => (
                            <div key={item.id} className="bg-white rounded-sm shadow-sm border border-ac-taupe/10 overflow-hidden flex flex-col">
                                {/* Image Preview */}
                                <div className="aspect-[4/5] relative bg-gray-50 group">
                                    <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                    >
                                        <X size={14} />
                                    </button>
                                    {item.status === 'uploading' && (
                                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                            <Loader2 className="animate-spin text-ac-taupe" />
                                        </div>
                                    )}
                                    {item.status === 'error' && (
                                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">Upload Failed</span>
                                        </div>
                                    )}
                                </div>

                                {/* Editor Fields */}
                                <div className="p-4 space-y-3 text-xs">
                                    {/* Name */}
                                    <div>
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                            className="w-full font-serif text-base bg-transparent border-b border-dashed border-ac-taupe/20 focus:outline-none focus:border-ac-gold pb-1 placeholder-ac-taupe/30"
                                            placeholder="Product Name"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <select
                                            value={item.category}
                                            onChange={(e) => updateItem(item.id, { category: e.target.value })}
                                            className="w-full bg-ac-taupe/5 border-none rounded-sm py-1.5 px-2 text-ac-taupe/80 focus:ring-1 focus:ring-ac-gold cursor-pointer"
                                        >
                                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    {/* Affiliate Links */}
                                    <div className="space-y-2 pt-1">
                                        <input
                                            type="text"
                                            value={item.affiliate_url_usa}
                                            onChange={(e) => updateItem(item.id, { affiliate_url_usa: e.target.value })}
                                            placeholder="🇺🇸 Affiliate Link (USA)"
                                            className="w-full bg-transparent border-b border-ac-taupe/10 focus:border-ac-gold focus:outline-none py-1"
                                        />
                                        <input
                                            type="text"
                                            value={item.affiliate_url_es}
                                            onChange={(e) => updateItem(item.id, { affiliate_url_es: e.target.value })}
                                            placeholder="🇪🇺 Affiliate Link (ES/EU)"
                                            className="w-full bg-transparent border-b border-ac-taupe/10 focus:border-ac-gold focus:outline-none py-1"
                                        />
                                    </div>

                                    {/* Note */}
                                    <div className="pt-2">
                                        <textarea
                                            value={item.curator_note}
                                            onChange={(e) => updateItem(item.id, { curator_note: e.target.value })}
                                            placeholder="Curator's Note (e.g. Size down...)"
                                            rows={2}
                                            className="w-full bg-ac-taupe/5 rounded-sm p-2 text-ac-taupe/80 focus:outline-none focus:ring-1 focus:ring-ac-gold resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
