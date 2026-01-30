"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon, Plus, Trash2 } from "lucide-react";
import { upsertService } from "@/app/actions/admin/manage-services";
import { uploadFile } from "@/app/actions/admin/upload-file";
import { toast } from "sonner";

interface ServiceFormProps {
    service?: any;
    onSuccess: () => void;
    onCancel?: () => void;
}

export default function ServiceForm({ service, onSuccess, onCancel }: ServiceFormProps) {
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [formData, setFormData] = useState({
        id: service?.id || undefined,
        title: service?.title || '',
        subtitle: service?.subtitle || '',
        description: service?.description || '',
        priceDisplay: service?.price_display || '',
        priceId: service?.price_id || '',
        stripeUrl: service?.stripe_url || '',
        stripeProductId: service?.stripe_product_id || '',
        imageUrl: service?.image_url || '',
        type: service?.type || 'session',
        orderIndex: service?.order_index || 0,
        active: service?.active ?? true,
        unlocksStudioAccess: service?.unlocks_studio_access ?? false,
    });

    const [tags, setTags] = useState<string[]>(service?.recommendation_tags || []);
    const [currentTag, setCurrentTag] = useState('');

    useEffect(() => {
        if (service) {
            setFormData({
                id: service.id,
                title: service.title,
                subtitle: service.subtitle || '',
                description: service.description || '',
                priceDisplay: service.price_display || '',
                priceId: service.price_id || '',
                stripeUrl: service.stripe_url || '',
                stripeProductId: service.stripe_product_id || '',
                imageUrl: service.image_url || '',
                type: service.type || 'session',
                orderIndex: service.order_index || 0,
                active: service.active ?? true,
                unlocksStudioAccess: service.unlocks_studio_access ?? false,
            });
            setTags(service.recommendation_tags || []);
        }
    }, [service]);

    // Image uploader
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;

            setUploadingImage(true);
            const file = acceptedFiles[0];
            const fd = new FormData();
            fd.append('file', file);

            const result = await uploadFile(fd);

            if (result.success) {
                setFormData(prev => ({ ...prev, imageUrl: result.url! }));
                toast.success('Image uploaded');
            } else {
                toast.error(result.error || 'Upload failed');
            }
            setUploadingImage(false);
        }
    });

    const handleAddTag = () => {
        if (!currentTag.trim()) return;
        if (tags.includes(currentTag.trim())) return;
        setTags([...tags, currentTag.trim()]);
        setCurrentTag('');
    };

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            recommendation_tags: tags,
            // Snake case mapping for DB
            price_display: formData.priceDisplay,
            price_id: formData.priceId,
            stripe_url: formData.stripeUrl,
            image_url: formData.imageUrl,
            order_index: formData.orderIndex,
            unlocks_studio_access: formData.unlocksStudioAccess,
        };

        // Remove camelCase keys that don't match DB columns if upsert is strict, 
        // but Supabase JS client usually ignores extra fields if not in schema? 
        // Safer to map explicitly.
        const dbPayload: any = {
            title: payload.title,
            subtitle: payload.subtitle,
            description: payload.description,
            price_display: payload.priceDisplay,
            price_id: payload.priceId,
            stripe_url: payload.stripeUrl,
            stripe_product_id: payload.stripeProductId,
            image_url: payload.imageUrl,
            type: payload.type,
            order_index: payload.orderIndex,
            active: payload.active,
            unlocks_studio_access: payload.unlocks_studio_access,
            recommendation_tags: tags,
        };

        if (formData.id) {
            dbPayload.id = formData.id;
        }

        const result = await upsertService(dbPayload);

        if (result.success) {
            toast.success(service ? 'Service updated' : 'Service created');
            onSuccess();
        } else {
            console.error("Save Error:", result.error);
            toast.error(result.error || 'Failed to save service');
        }

        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">
                {service ? 'Edit Service' : 'New Service'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Image & Type */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Service Type
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold"
                        >
                            <option value="session">Session (One-time)</option>
                            <option value="retainer">Retainer (Subscription)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Editorial Image
                        </label>
                        {formData.imageUrl ? (
                            <div className="relative aspect-[3/4] rounded-sm overflow-hidden border border-ac-taupe/20 bg-ac-taupe/5">
                                <img src={formData.imageUrl} alt="Service" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors aspect-[3/4] flex flex-col items-center justify-center ${isDragActive
                                    ? 'border-ac-gold bg-ac-gold/5'
                                    : 'border-ac-taupe/20 hover:border-ac-gold/50 bg-white/20 backdrop-blur-md'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <ImageIcon size={32} className="mx-auto mb-3 text-ac-taupe/40" />
                                <p className="text-sm text-ac-taupe/60">
                                    {uploadingImage ? 'Uploading...' : 'Drop image here'}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-white/40 p-4 rounded-sm border border-ac-taupe/5">
                        <input
                            type="checkbox"
                            id="active"
                            checked={formData.active}
                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                            className="w-5 h-5 accent-ac-gold cursor-pointer"
                        />
                        <label htmlFor="active" className="block text-sm font-bold text-ac-taupe cursor-pointer">
                            Active (Visible to public)
                        </label>
                    </div>

                    <div className="flex items-center gap-3 bg-ac-gold/10 p-4 rounded-sm border border-ac-gold/20">
                        <input
                            type="checkbox"
                            id="unlocksStudio"
                            checked={formData.unlocksStudioAccess}
                            onChange={(e) => setFormData({ ...formData, unlocksStudioAccess: e.target.checked })}
                            className="w-5 h-5 accent-ac-gold cursor-pointer"
                        />
                        <div>
                            <label htmlFor="unlocksStudio" className="block text-sm font-bold text-ac-taupe cursor-pointer">
                                Unlocks Studio Access
                            </label>
                            <p className="text-[10px] text-ac-taupe/60 uppercase tracking-widest mt-1">
                                Automatically grants Wardrobe + Lookbook access on purchase
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right: Details */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Title
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="The Personal Stylist"
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Subtitle / Tagline
                        </label>
                        <input
                            type="text"
                            value={formData.subtitle}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            placeholder="An architectural deep dive..."
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            placeholder="Detailed explanation of the service..."
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Price Display
                            </label>
                            <input
                                type="text"
                                value={formData.priceDisplay}
                                onChange={(e) => setFormData({ ...formData, priceDisplay: e.target.value })}
                                placeholder="$500"
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Order Index
                            </label>
                            <input
                                type="number"
                                value={formData.orderIndex}
                                onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 bg-ac-taupe/5 p-4 rounded-sm">
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                            Stripe Integration & Payment
                        </label>

                        {/* Generator */}
                        <div className="flex gap-4 items-end mb-4 border-b border-ac-taupe/5 pb-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                                    Generator Price (USD)
                                </label>
                                <input
                                    type="number"
                                    placeholder="500"
                                    className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-2 text-sm"
                                    id="gen-price-input-service"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    const priceInput = document.getElementById('gen-price-input-service') as HTMLInputElement;
                                    const price = parseFloat(priceInput.value);
                                    if (!formData.title) {
                                        toast.error("Please enter a Title first");
                                        return;
                                    }
                                    if (!price || price <= 0) {
                                        toast.error("Please enter a valid price");
                                        return;
                                    }

                                    const toastId = toast.loading("Generating Stripe Product...");
                                    const { createStripeProduct } = await import('@/app/actions/admin/stripe-product');
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

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                                    Stripe Product ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.stripeProductId}
                                    onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                                    placeholder="prod_..."
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                                    Stripe Price ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.priceId}
                                    onChange={(e) => setFormData({ ...formData, priceId: e.target.value })}
                                    placeholder="price_..."
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                                    Direct Payment Link (Legacy)
                                </label>
                                <input
                                    type="text"
                                    value={formData.stripeUrl}
                                    onChange={(e) => setFormData({ ...formData, stripeUrl: e.target.value })}
                                    placeholder="https://buy.stripe.com/..."
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                            Recommendation Tags (Essence Matching)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                placeholder="E.g., detox_goal"
                                className="flex-1 bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="bg-ac-taupe text-white p-3 rounded-sm hover:bg-ac-taupe/90"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <span key={tag} className="flex items-center gap-1 bg-ac-gold/20 text-ac-taupe text-xs px-2 py-1 rounded-full">
                                    {tag}
                                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-600">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-ac-taupe/60 italic">
                            Match these tags with Essence Lab answer keys to auto-recommend this service.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 justify-end border-t border-ac-taupe/10 pt-6">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 border border-ac-taupe/20 rounded-sm text-ac-taupe hover:bg-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-ac-taupe text-white rounded-sm hover:bg-ac-taupe/90 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Service'}
                </button>
            </div>
        </form>
    );
}
