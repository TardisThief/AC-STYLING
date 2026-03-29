"use client";

import { useState, useEffect } from "react";
import { upsertOffer, getOffer } from "@/app/actions/admin/manage-offers";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface FullAccessFormProps {
    onClose: () => void;
}

export default function FullAccessForm({ onClose }: FullAccessFormProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const [formData, setFormData] = useState({
        id: undefined as string | undefined,
        slug: 'full_access',
        title: 'AC Styling: The Full Vault',
        description: 'Complete access to all Masterclasses, Chapters, and future content.',
        priceDisplay: '$2,500',
        priceId: '',
        stripeProductId: '',
        active: true,
    });

    useEffect(() => {
        const load = async () => {
            const res = await getOffer('full_access');
            if (res.success && res.offer) {
                setFormData({
                    id: res.offer.id,
                    slug: res.offer.slug,
                    title: res.offer.title,
                    description: res.offer.description || '',
                    priceDisplay: res.offer.price_display || '',
                    priceId: res.offer.price_id || '',
                    stripeProductId: res.offer.stripe_product_id || '',
                    active: res.offer.active,
                });
            }
            setFetching(false);
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            id: formData.id,
            slug: formData.slug,
            title: formData.title,
            description: formData.description,
            price_display: formData.priceDisplay,
            price_id: formData.priceId,
            stripe_product_id: formData.stripeProductId,
            active: formData.active,
        };

        const res = await upsertOffer(payload);
        if (res.success) {
            toast.success("Full Access Configuration Saved");
            onClose();
        } else {
            toast.error(res.error || "Failed to save");
        }
        setLoading(false);
    };

    if (fetching) return <div className="p-8 text-center text-ac-taupe"><Loader2 className="animate-spin inline mr-2" /> Loading config...</div>;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">
                Configure "Full Access" Offer
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Title</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Pop-up Description</label>
                    <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Display Price</label>
                    <input
                        type="text"
                        value={formData.priceDisplay}
                        onChange={(e) => setFormData({ ...formData, priceDisplay: e.target.value })}
                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe"
                    />
                </div>
            </div>

            {/* Generator */}
            <div className="bg-ac-taupe/5 p-4 rounded-sm border border-ac-taupe/10">
                <h4 className="text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-4">Stripe Configuration</h4>

                <div className="flex gap-4 items-end mb-4 border-b border-ac-taupe/5 pb-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                            Generator Price (USD)
                        </label>
                        <input
                            type="number"
                            placeholder="2500"
                            className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-2 text-sm"
                            id="gen-price-input-full"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            const priceInput = document.getElementById('gen-price-input-full') as HTMLInputElement;
                            const price = parseFloat(priceInput.value);
                            if (!price || price <= 0) {
                                toast.error("Please enter a valid price");
                                return;
                            }

                            const toastId = toast.loading("Generating Stripe Product...");
                            const { createStripeProduct } = await import('@/app/actions/admin/stripe-product');
                            // We can use 'service' or 'masterclass' type, or adding a new 'offer' type. Using 'service' for generic.
                            const res = await createStripeProduct(formData.title, price, 'service');

                            if (res.success && res.productId && res.priceId) {
                                setFormData(prev => ({
                                    ...prev,
                                    stripeProductId: res.productId!,
                                    priceId: res.priceId!
                                }));
                                toast.success("Stripe Product Created!", { id: toastId });
                            } else {
                                toast.error(res.error || "Failed to generate", { id: toastId });
                            }
                        }}
                        className="px-4 py-2 bg-ac-gold text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-ac-gold/80 h-[38px]"
                    >
                        Generate
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">Product ID</label>
                        <input
                            type="text"
                            value={formData.stripeProductId}
                            onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-xs font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">Price ID</label>
                        <input
                            type="text"
                            value={formData.priceId}
                            onChange={(e) => setFormData({ ...formData, priceId: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-xs font-mono"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-ac-taupe/10 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-ac-taupe/20 text-ac-taupe rounded-sm">Cancel</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-ac-taupe text-white rounded-sm hover:bg-ac-taupe/90">
                    {loading ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </form>
    );
}
