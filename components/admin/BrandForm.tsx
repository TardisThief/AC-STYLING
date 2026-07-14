
"use client";

import { useState } from "react";
import type { PartnerBrand } from "@/app/lib/types";
import { createBrand, updateBrand } from "@/app/actions/admin/manage-boutique";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface BrandFormProps {
    brand?: PartnerBrand;
    onSuccess: () => void;
    onCancel: () => void;
}

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'paused', label: 'Paused' },
    { value: 'inactive', label: 'Inactive' },
];

export default function BrandForm({ brand, onSuccess, onCancel }: BrandFormProps) {
    const [loading, setLoading] = useState(false);
    const [showCrm, setShowCrm] = useState(false);
    const [formData, setFormData] = useState({
        name: brand?.name || "",
        logo_url: brand?.logo_url || "",
        website_url: brand?.website_url || "",
        active: brand?.active ?? true,
        // CRM fields
        contact_name: brand?.contact_name || "",
        contact_email: brand?.contact_email || "",
        commission_rate: brand?.commission_rate ?? "",
        partnership_status: brand?.partnership_status || "active",
        internal_notes: brand?.internal_notes || "",
    });

    const set = (key: string, value: unknown) => setFormData(prev => ({ ...prev, [key]: value }));

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
            {/* Core fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Brand Name *</label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => set('name', e.target.value)}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Website URL</label>
                    <input
                        type="text"
                        placeholder="https://..."
                        value={formData.website_url}
                        onChange={(e) => set('website_url', e.target.value)}
                        className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Logo</label>
                <ImageUpload
                    value={formData.logo_url}
                    onChange={(url) => set('logo_url', url)}
                    placeholder="Upload Logo"
                    bucket="boutique"
                />
                <p className="text-[10px] text-ac-taupe/40 mt-1">Use a transparent PNG if possible.</p>
            </div>

            <div className="flex items-center gap-3">
                <input type="checkbox" id="brand-active" checked={formData.active} onChange={(e) => set('active', e.target.checked)} className="accent-ac-gold" />
                <label htmlFor="brand-active" className="text-xs font-bold uppercase tracking-widest text-ac-taupe/60">Active (visible in boutique)</label>
            </div>

            {/* CRM section — collapsible */}
            <div className="border border-ac-taupe/10 rounded-sm overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowCrm(!showCrm)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-ac-taupe/5 text-xs font-bold uppercase tracking-widest text-ac-taupe/60 hover:bg-ac-taupe/10 transition-colors"
                >
                    <span>CRM Details (Partnership Info)</span>
                    {showCrm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showCrm && (
                    <div className="p-4 space-y-4 bg-white/40">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Contact Name</label>
                                <input
                                    type="text"
                                    placeholder="Rep / Account Manager"
                                    value={formData.contact_name}
                                    onChange={(e) => set('contact_name', e.target.value)}
                                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Contact Email</label>
                                <input
                                    type="email"
                                    placeholder="contact@brand.com"
                                    value={formData.contact_email}
                                    onChange={(e) => set('contact_email', e.target.value)}
                                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Commission Rate (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    placeholder="e.g. 8.5"
                                    value={formData.commission_rate}
                                    onChange={(e) => set('commission_rate', e.target.value)}
                                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Partnership Status</label>
                                <select
                                    value={formData.partnership_status}
                                    onChange={(e) => set('partnership_status', e.target.value)}
                                    className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                                >
                                    {STATUS_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Internal Notes</label>
                            <textarea
                                rows={3}
                                placeholder="Private notes about this partnership..."
                                value={formData.internal_notes}
                                onChange={(e) => set('internal_notes', e.target.value)}
                                className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
