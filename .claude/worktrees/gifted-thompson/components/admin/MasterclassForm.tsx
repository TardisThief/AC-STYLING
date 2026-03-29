"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { createMasterclass, updateMasterclass } from "@/app/actions/admin/manage-masterclasses";
import { uploadFile } from "@/app/actions/admin/upload-file";
import { toast } from "sonner";

interface MasterclassFormProps {
    masterclass?: any;
    onSuccess: () => void;
    onCancel?: () => void;
}

// ... (imports)
import { Video } from "lucide-react";



export default function MasterclassForm({ masterclass, onSuccess, onCancel }: MasterclassFormProps) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'en' | 'es'>('en');
    const [formData, setFormData] = useState({
        title: masterclass?.title || '',
        subtitle: masterclass?.subtitle || '',
        description: masterclass?.description || '',
        titleEs: masterclass?.title_es || '',
        subtitleEs: masterclass?.subtitle_es || '',
        descriptionEs: masterclass?.description_es || '',
        thumbnailUrl: masterclass?.thumbnail_url || '',
        videoUrl: masterclass?.video_url || '',
        orderIndex: masterclass?.order_index || 0,
        stripeProductId: masterclass?.stripe_product_id || '',
        priceId: masterclass?.price_id || '',
    });

    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

    useEffect(() => {
        setFormData({
            title: masterclass?.title || '',
            subtitle: masterclass?.subtitle || '',
            description: masterclass?.description || '',
            titleEs: masterclass?.title_es || '',
            subtitleEs: masterclass?.subtitle_es || '',
            descriptionEs: masterclass?.description_es || '',
            thumbnailUrl: masterclass?.thumbnail_url || '',
            videoUrl: masterclass?.video_url || '',
            orderIndex: masterclass?.order_index || 0,
            stripeProductId: masterclass?.stripe_product_id || '',
            priceId: masterclass?.price_id || '',
        });
    }, [masterclass]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;
            setUploadingThumbnail(true);
            const fd = new FormData();
            fd.append('file', acceptedFiles[0]);
            const result = await uploadFile(fd);
            if (result.success) {
                setFormData({ ...formData, thumbnailUrl: result.url! });
                toast.success('Thumbnail uploaded');
            } else {
                toast.error(result.error || 'Upload failed');
            }
            setUploadingThumbnail(false);
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('subtitle', formData.subtitle);
        fd.append('description', formData.description);
        fd.append('titleEs', formData.titleEs);
        fd.append('subtitleEs', formData.subtitleEs);
        fd.append('descriptionEs', formData.descriptionEs);
        fd.append('thumbnailUrl', formData.thumbnailUrl);
        fd.append('videoUrl', formData.videoUrl);
        fd.append('orderIndex', formData.orderIndex.toString());
        fd.append('stripeProductId', formData.stripeProductId);
        fd.append('priceId', formData.priceId);

        const result = masterclass
            ? await updateMasterclass(masterclass.id, fd)
            : await createMasterclass(fd);

        if (result.success) {
            toast.success(masterclass ? 'Masterclass updated' : 'Masterclass created');
            onSuccess();
            if (!masterclass) {
                setFormData({
                    title: '', subtitle: '', description: '',
                    titleEs: '', subtitleEs: '', descriptionEs: '',
                    thumbnailUrl: '', videoUrl: '', orderIndex: 0, stripeProductId: '', priceId: ''
                });
            }
        } else {
            toast.error(result.error);
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">
                {masterclass ? 'Edit Masterclass' : 'New Masterclass'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Image Upload */}
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                        Cover Image
                    </label>
                    {formData.thumbnailUrl ? (
                        <div className="relative aspect-video rounded-sm overflow-hidden border border-ac-taupe/20">
                            <img src={formData.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors aspect-video flex flex-col items-center justify-center ${isDragActive
                                ? 'border-ac-gold bg-ac-gold/5'
                                : 'border-ac-taupe/20 hover:border-ac-gold/50 bg-white/20'
                                }`}
                        >
                            <input {...getInputProps()} />
                            <ImageIcon size={32} className="mx-auto mb-3 text-ac-taupe/40" />
                            <p className="text-sm text-ac-taupe/60">
                                {uploadingThumbnail ? 'Uploading...' : 'Drop cover image here'}
                            </p>
                        </div>
                    )}
                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                        Teaser Video (Optional)
                    </label>
                    {/* We can reuse the dropzone info or create a new one, but for simplicity we will just use a second dropzone component or existing upload logic if we can split it. 
                         Since hooks like useDropzone can be used multiple times, let's just make a helper or duplicate the dropzone for now for speed.
                      */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                            Vimeo ID (Teaser)
                        </label>
                        <input
                            type="text"
                            value={formData.videoUrl}
                            // Note: Keeping formData key as 'videoUrl' for minimal refactor, 
                            // but conceptually it's the ID.
                            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold font-mono text-xs"
                            placeholder="e.g. 123456789"
                        />
                        <p className="text-[10px] text-ac-taupe/60">
                            Enter the Vimeo video ID for the masterclass teaser.
                        </p>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                    {/* Language Tabs */}
                    <div className="flex gap-4 border-b border-ac-taupe/10 mb-4">
                        <button
                            type="button"
                            onClick={() => setActiveTab('en')}
                            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'en' ? 'text-ac-gold border-b-2 border-ac-gold' : 'text-ac-taupe/40 hover:text-ac-taupe'}`}
                        >
                            English
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('es')}
                            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'es' ? 'text-ac-gold border-b-2 border-ac-gold' : 'text-ac-taupe/40 hover:text-ac-taupe'}`}
                        >
                            Spanish
                        </button>
                    </div>

                    {activeTab === 'en' ? (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Title (EN)</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    placeholder="e.g. Color Mastery"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Subtitle (EN)</label>
                                <input
                                    type="text"
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    placeholder="e.g. The definitive guide to palette"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Description (EN)</label>
                                <textarea
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold resize-none"
                                    placeholder="What will students learn in this masterclass?"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Título (ES)</label>
                                <input
                                    type="text"
                                    value={formData.titleEs}
                                    onChange={(e) => setFormData({ ...formData, titleEs: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    placeholder="e.g. Maestría del Color"
                                />
                            </div>
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Subtítulo (ES)</label>
                                <input
                                    type="text"
                                    value={formData.subtitleEs}
                                    onChange={(e) => setFormData({ ...formData, subtitleEs: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    placeholder="e.g. La guía definitiva..."
                                />
                            </div>
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Descripción (ES)</label>
                                <textarea
                                    rows={4}
                                    value={formData.descriptionEs}
                                    onChange={(e) => setFormData({ ...formData, descriptionEs: e.target.value })}
                                    className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold resize-none"
                                    placeholder="¿Qué aprenderán los estudiantes?"
                                />
                            </div>
                        </>
                    )}


                    <div className="pt-4 border-t border-ac-taupe/10">
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Order Index</label>
                        <input
                            type="number"
                            value={formData.orderIndex}
                            onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                        />
                    </div>
                </div>
            </div>

            {/* Stripe moved to bottom or kept in grid? Kept separate for safety */}
            <div className="bg-ac-taupe/5 p-6 rounded-sm border border-ac-taupe/10">
                <h4 className="text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-3">Stripe Integration</h4>

                <div className="flex gap-4 items-end mb-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-ac-taupe/60 uppercase tracking-widest mb-1">
                            Generator Price (USD)
                        </label>
                        <input
                            type="number"
                            placeholder="50"
                            className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-2 text-sm"
                            id="gen-price-input"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            const priceInput = document.getElementById('gen-price-input') as HTMLInputElement;
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
                            const res = await createStripeProduct(formData.title, price, 'masterclass');

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
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Stripe Product ID</label>
                        <input
                            type="text"
                            value={formData.stripeProductId}
                            onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold font-mono text-xs"
                            placeholder="prod_..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Stripe Price ID</label>
                        <input
                            type="text"
                            value={formData.priceId}
                            onChange={(e) => setFormData({ ...formData, priceId: e.target.value })}
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:border-ac-gold focus:ring-1 focus:ring-ac-gold font-mono text-xs"
                            placeholder="price_..."
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-4 justify-end border-t border-ac-taupe/10 pt-6">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 border border-ac-taupe/20 rounded-sm text-ac-taupe hover:bg-white/20"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-ac-taupe text-white rounded-sm hover:bg-ac-taupe/90 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : masterclass ? 'Update Masterclass' : 'Create Masterclass'}
                </button>
            </div>
        </form >
    );
}
