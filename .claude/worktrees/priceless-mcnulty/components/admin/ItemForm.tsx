
"use client";

import { useState } from "react";
import { createBoutiqueItem, updateBoutiqueItem } from "@/app/actions/admin/manage-boutique";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface ItemFormProps {
    item?: any;
    brands: any[];
    onSuccess: () => void;
    onCancel: () => void;
}

export default function ItemForm({ item, brands, onSuccess, onCancel }: ItemFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: item?.name || "",
        brand_id: item?.brand_id || "",
        image_url: item?.image_url || "",
        curator_note: item?.curator_note || "",
        affiliate_url_usa: item?.affiliate_url_usa || "",
        affiliate_url_es: item?.affiliate_url_es || "",
        category: item?.category || "",
        active: item?.active ?? true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const action = item ? updateBoutiqueItem(item.id, formData) : createBoutiqueItem(formData);
        const res = await action;

        if (res.success) {
            toast.success(item ? "Item updated" : "Item created");
            onSuccess();
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Brand</label>
                    <select
                        required
                        value={formData.brand_id}
                        onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    >
                        <option value="">Select Brand...</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Category</label>
                    <input
                        type="text"
                        placeholder="E.g. Shoes, Bags..."
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Product Name</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Product Image</label>
                <ImageUpload
                    value={formData.image_url}
                    onChange={(url) => setFormData({ ...formData, image_url: url })}
                    placeholder="Upload Product Shot"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Alejandra's Tip (Curator Note)</label>
                <textarea
                    placeholder="Why this item?"
                    value={formData.curator_note}
                    onChange={(e) => setFormData({ ...formData, curator_note: e.target.value })}
                    rows={2}
                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold resize-none"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Affiliate URL (USA)</label>
                    <input
                        type="text"
                        value={formData.affiliate_url_usa}
                        onChange={(e) => setFormData({ ...formData, affiliate_url_usa: e.target.value })}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Affiliate URL (ES/EU)</label>
                    <input
                        type="text"
                        value={formData.affiliate_url_es}
                        onChange={(e) => setFormData({ ...formData, affiliate_url_es: e.target.value })}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-ac-taupe/60 hover:text-ac-taupe">Cancel</button>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-ac-taupe text-white px-6 py-2 rounded-sm hover:bg-ac-taupe/90 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {item ? 'Update Item' : 'Add to Boutique'}
                </button>
            </div>
        </form>
    );
}
