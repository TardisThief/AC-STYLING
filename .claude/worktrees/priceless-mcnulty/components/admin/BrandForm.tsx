
"use client";

import { useState } from "react";
import { createBrand, updateBrand } from "@/app/actions/admin/manage-boutique";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface BrandFormProps {
    brand?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function BrandForm({ brand, onSuccess, onCancel }: BrandFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: brand?.name || "",
        logo_url: brand?.logo_url || "",
        website_url: brand?.website_url || "",
        active: brand?.active ?? true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const action = brand ? updateBrand(brand.id, formData) : createBrand(formData);
        const res = await action;

        if (res.success) {
            toast.success(brand ? "Brand updated" : "Brand created");
            onSuccess();
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Brand Name</label>
                <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Logo</label>
                <ImageUpload
                    value={formData.logo_url}
                    onChange={(url) => setFormData({ ...formData, logo_url: url })}
                    placeholder="Upload Logo"
                />
                <p className="text-[10px] text-ac-taupe/40 mt-1">Use a transparent PNG if possible.</p>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Website URL</label>
                <input
                    type="text"
                    placeholder="https://..."
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-ac-taupe/60 hover:text-ac-taupe">Cancel</button>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-ac-taupe text-white px-6 py-2 rounded-sm hover:bg-ac-taupe/90 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {brand ? 'Update Brand' : 'Create Brand'}
                </button>
            </div>
        </form>
    );
}
