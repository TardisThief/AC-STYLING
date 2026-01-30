"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { createChapter, updateChapter } from "@/app/actions/admin/manage-chapters";
import { getMasterclasses } from "@/app/actions/admin/manage-masterclasses";
import { uploadFile } from "@/app/actions/admin/upload-file";
import { toast } from "sonner";

interface Chapter {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    title_es?: string;
    subtitle_es?: string;
    description_es?: string;
    video_id: string;
    video_id_es: string;
    thumbnail_url: string;
    category: string;
    order_index: number;
    masterclass_id: string;
    is_standalone: boolean;
    lab_questions: LabQuestion[];
    takeaways: string[];
    takeaways_es?: string[];
    resource_urls: ResourceUrl[];
    stripe_product_id?: string;
    price_id?: string;
}

interface LabQuestion {
    key: string;
    label: string;
    placeholder: string;
    label_es?: string;
    placeholder_es?: string;
    mapToEssence?: boolean;
    mappingCategory?: string;
}

interface ResourceUrl {
    name: string;
    url: string;
}

interface ChapterFormProps {
    chapter?: Chapter;
    onSuccess: () => void;
    onCancel?: () => void;
}

export default function ChapterForm({ chapter, onSuccess, onCancel }: ChapterFormProps) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'en' | 'es'>('en');
    const [formData, setFormData] = useState({
        slug: chapter?.slug || '',
        title: chapter?.title || '',
        subtitle: chapter?.subtitle || '',
        description: chapter?.description || '',
        titleEs: chapter?.title_es || '',
        subtitleEs: chapter?.subtitle_es || '',
        descriptionEs: chapter?.description_es || '',
        videoId: chapter?.video_id || '',
        videoIdEs: chapter?.video_id_es || '',
        thumbnailUrl: chapter?.thumbnail_url || '',
        category: chapter?.category || 'masterclass',
        orderIndex: chapter?.order_index || 0,
        masterclassId: chapter?.masterclass_id || '',
        isStandalone: chapter?.is_standalone ?? true,
        stripeProductId: chapter?.stripe_product_id || '',
        priceId: chapter?.price_id || '',
    });

    const [masterclasses, setMasterclasses] = useState<any[]>([]);

    useEffect(() => {
        getMasterclasses().then(res => {
            if (res.success) setMasterclasses(res.masterclasses || []);
        });
    }, []);

    const [labQuestions, setLabQuestions] = useState<LabQuestion[]>(
        chapter?.lab_questions || []
    );
    const [takeaways, setTakeaways] = useState<string[]>(
        chapter?.takeaways || []
    );
    const [takeawaysEs, setTakeawaysEs] = useState<string[]>(
        chapter?.takeaways_es || []
    );
    const [resourceUrls, setResourceUrls] = useState<Array<{ name: string, url: string }>>(
        chapter?.resource_urls || []
    );

    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Sync state when chapter prop changes
    useEffect(() => {
        setFormData({
            slug: chapter?.slug || '',
            title: chapter?.title || '',
            subtitle: chapter?.subtitle || '',
            description: chapter?.description || '',
            titleEs: chapter?.title_es || '',
            subtitleEs: chapter?.subtitle_es || '',
            descriptionEs: chapter?.description_es || '',
            videoId: chapter?.video_id || '',
            videoIdEs: chapter?.video_id_es || '',
            thumbnailUrl: chapter?.thumbnail_url || '',
            category: chapter?.category || 'masterclass',
            orderIndex: chapter?.order_index || 0,
            masterclassId: chapter?.masterclass_id || '',
            isStandalone: chapter?.is_standalone ?? true,
            stripeProductId: chapter?.stripe_product_id || '',
            priceId: chapter?.price_id || '',
        });
        setLabQuestions(chapter?.lab_questions || []);
        setTakeaways(chapter?.takeaways || []);
        setTakeawaysEs(chapter?.takeaways_es || []);
        setResourceUrls(chapter?.resource_urls || []);
    }, [chapter]);

    // Thumbnail uploader
    const { getRootProps: getThumbnailProps, getInputProps: getThumbnailInput, isDragActive: isThumbnailDrag } = useDropzone({
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;

            setUploadingThumbnail(true);
            const file = acceptedFiles[0];
            const fd = new FormData();
            fd.append('file', file);

            const result = await uploadFile(fd);

            if (result.success) {
                setFormData({ ...formData, thumbnailUrl: result.url! });
                toast.success('Thumbnail uploaded');
            } else {
                toast.error(result.error || 'Upload failed. Check storage permissions.');
            }
            setUploadingThumbnail(false);
        }
    });

    // Resource PDF uploader
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;

            setUploadingFile(true);
            const file = acceptedFiles[0];
            const fd = new FormData();
            fd.append('file', file);

            const result = await uploadFile(fd);

            if (result.success) {
                setResourceUrls([...resourceUrls, { name: file.name, url: result.url! }]);
                toast.success('File uploaded');
            } else {
                toast.error(result.error || 'Upload failed. Check storage permissions.');
            }
            setUploadingFile(false);
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const fd = new FormData();
        fd.append('slug', formData.slug);
        fd.append('title', formData.title);
        fd.append('subtitle', formData.subtitle);
        fd.append('description', formData.description);
        fd.append('titleEs', formData.titleEs);
        fd.append('subtitleEs', formData.subtitleEs);
        fd.append('descriptionEs', formData.descriptionEs);
        fd.append('videoId', formData.videoId);
        fd.append('videoIdEs', formData.videoIdEs);
        fd.append('thumbnailUrl', formData.thumbnailUrl);
        fd.append('category', formData.category);
        fd.append('orderIndex', formData.orderIndex.toString());
        fd.append('masterclassId', formData.masterclassId);
        fd.append('isStandalone', formData.isStandalone.toString());
        fd.append('stripeProductId', formData.stripeProductId);
        fd.append('priceId', formData.priceId);
        fd.append('labQuestions', JSON.stringify(labQuestions));
        fd.append('takeaways', JSON.stringify(takeaways));
        fd.append('takeawaysEs', JSON.stringify(takeawaysEs));
        fd.append('resourceUrls', JSON.stringify(resourceUrls));

        const result = chapter
            ? await updateChapter(chapter.id, fd)
            : await createChapter(fd);

        if (result.success) {
            toast.success(chapter ? 'Chapter updated' : 'Chapter created');
            onSuccess();
            // Reset form if creating new
            if (!chapter) {
                setFormData({
                    slug: '', title: '', subtitle: '', description: '',
                    titleEs: '', subtitleEs: '', descriptionEs: '',
                    videoId: '', videoIdEs: '', thumbnailUrl: '', category: 'masterclass',
                    orderIndex: 0, masterclassId: '', isStandalone: true, stripeProductId: '', priceId: ''
                });
                setLabQuestions([]);
                setTakeaways([]);
                setTakeawaysEs([]);
                setResourceUrls([]);
            }
        } else {
            console.error("Save Error:", result.error);
            toast.error(result.error || 'Something went wrong. Check terminal for details.');
        }

        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-10">

            {/* SECTION 1: Display Info */}
            <div className="space-y-6">
                <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">Display Info</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Thumbnail Upload */}
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                            Chapter Thumbnail
                        </label>

                        {formData.thumbnailUrl ? (
                            <div className="relative aspect-video rounded-sm overflow-hidden border border-ac-taupe/20 bg-ac-taupe/5">
                                <Image
                                    src={formData.thumbnailUrl}
                                    alt="Thumbnail"
                                    fill
                                    className="object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors z-10"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div
                                {...getThumbnailProps()}
                                className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors aspect-video flex flex-col items-center justify-center ${isThumbnailDrag
                                    ? 'border-ac-gold bg-ac-gold/5'
                                    : 'border-ac-taupe/20 hover:border-ac-gold/50 bg-white/20 backdrop-blur-md'
                                    }`}
                            >
                                <input {...getThumbnailInput()} />
                                <ImageIcon size={32} className="mx-auto mb-3 text-ac-taupe/40" />
                                <p className="text-sm text-ac-taupe/60">
                                    {uploadingThumbnail ? 'Uploading...' : 'Drop image here or click'}
                                </p>
                                <p className="text-xs text-ac-taupe/40 mt-1">JPG, PNG, or WebP</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Basic Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Slug (URL)
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                placeholder="color-theory"
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                            >
                                <option value="masterclass">Masterclass</option>
                                <option value="course">Course</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Display Order
                            </label>
                            <input
                                type="number"
                                value={formData.orderIndex || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const intVal = parseInt(val);
                                    setFormData({ ...formData, orderIndex: isNaN(intVal) ? 0 : intVal });
                                }}
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                            />
                        </div>
                    </div>
                </div>

                {/* Title & Subtitle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Title
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Understanding Color Theory"
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Subtitle
                        </label>
                        <input
                            type="text"
                            maxLength={100}
                            value={formData.subtitle}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            placeholder="Discover your perfect palette"
                            className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                        />
                        <p className="text-xs text-ac-taupe/40 mt-1">{formData.subtitle.length}/100</p>
                    </div>
                </div>
            </div>


            {/* Masterclass Assignment */}
            <div className="p-6 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm">
                <h3 className="font-serif text-xl text-ac-taupe border-b border-ac-taupe/10 pb-3 mb-4">
                    Organization
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                            Parent Masterclass
                        </label>
                        <select
                            value={formData.masterclassId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData({
                                    ...formData,
                                    masterclassId: val,
                                    isStandalone: val ? false : true // Auto-toggle standalone
                                });
                            }}
                            className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                        >
                            <option value="">-- None (Standalone Lesson) --</option>
                            {masterclasses.map(mc => (
                                <option key={mc.id} value={mc.id}>{mc.title}</option>
                            ))}
                        </select>
                        <p className="text-xs text-ac-taupe/40 mt-2">
                            Linking to a masterclass will group this chapter under that collection.
                        </p>
                    </div>

                    <div className="flex items-center">
                        <div className="flex items-center gap-3 bg-white/40 p-4 rounded-sm border border-ac-taupe/5 w-full">
                            <input
                                type="checkbox"
                                id="isStandalone"
                                checked={formData.isStandalone}
                                onChange={(e) => setFormData({ ...formData, isStandalone: e.target.checked })}
                                disabled={!!formData.masterclassId} // Lock if masterclass selected
                                className="w-5 h-5 accent-ac-gold cursor-pointer"
                            />
                            <div>
                                <label htmlFor="isStandalone" className="block text-sm font-bold text-ac-taupe cursor-pointer">
                                    Mark as Standalone
                                </label>
                                <p className="text-xs text-ac-taupe/60">
                                    Standalone lessons appear in the &quot;Single Lessons&quot; feed.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: Lesson Content */}
            <div className="space-y-6">
                <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">Lesson Content</h3>

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


                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Video & Description */}
                    <div className="space-y-4">
                        {activeTab === 'en' ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Vimeo ID (English)
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.videoId}
                                        onChange={(e) => setFormData({ ...formData, videoId: e.target.value })}
                                        placeholder="76979871"
                                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Full Lesson Content (EN)
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={6}
                                        placeholder="Detailed description..."
                                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold resize-none"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Vimeo ID (Spanish)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.videoIdEs}
                                        onChange={(e) => setFormData({ ...formData, videoIdEs: e.target.value })}
                                        placeholder="76979871"
                                        className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                    />
                                </div>

                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Título (ES)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.titleEs}
                                        onChange={(e) => setFormData({ ...formData, titleEs: e.target.value })}
                                        className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                        placeholder="e.g. Título del Capítulo"
                                    />
                                </div>

                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Subtítulo (ES)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.subtitleEs}
                                        onChange={(e) => setFormData({ ...formData, subtitleEs: e.target.value })}
                                        className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold"
                                        placeholder="e.g. Subtítulo..."
                                    />
                                </div>

                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                        Contenido (ES)
                                    </label>
                                    <textarea
                                        value={formData.descriptionEs}
                                        onChange={(e) => setFormData({ ...formData, descriptionEs: e.target.value })}
                                        rows={6}
                                        placeholder="Descripción detallada en español..."
                                        className="w-full bg-white/40 border border-ac-gold/30 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Essence Lab Questions */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                                {activeTab === 'en' ? 'Essence Lab Questions (Shared Keys)' : 'Preguntas Essence Lab (Traducción)'}
                            </label>
                            <button
                                type="button"
                                onClick={() => setLabQuestions([...labQuestions, { key: '', label: '', placeholder: '' }])}
                                className="text-ac-gold hover:text-ac-olive"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {labQuestions.map((q, i) => (
                                <div key={i} className="bg-white/20 p-4 rounded-sm space-y-3 border border-ac-taupe/5">
                                    <div className="flex justify-between items-center bg-ac-taupe/5 p-2 rounded-sm -mx-2 -mt-2 mb-2">
                                        <span className="text-xs font-bold text-ac-taupe/60 uppercase tracking-widest">Question {i + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => setLabQuestions(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-red-500 hover:text-red-700 bg-white/40 p-1 rounded-sm"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] text-ac-taupe/40 uppercase font-bold">
                                                Question Key (Unique ID)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. style_words_1 (Shared)"
                                                value={q.key}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setLabQuestions(prev => prev.map((item, idx) => idx === i ? { ...item, key: newVal } : item));
                                                }}
                                                disabled={activeTab === 'es'}
                                                className={`w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold font-mono ${activeTab === 'es' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            />
                                            {activeTab === 'es' && <p className="text-[9px] text-ac-gold mt-1">Key is shared. Edit in English tab.</p>}
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-ac-taupe/40 uppercase font-bold">
                                                {activeTab === 'en' ? 'User Label (EN)' : 'Etiqueta (ES)'}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={activeTab === 'en' ? "e.g. What is your first word?" : "e.g. ¿Cual es tu primera palabra?"}
                                                value={activeTab === 'en' ? q.label : (q.label_es || '')}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setLabQuestions(prev => prev.map((item, idx) => {
                                                        if (idx !== i) return item;
                                                        return activeTab === 'en'
                                                            ? { ...item, label: newVal }
                                                            : { ...item, label_es: newVal };
                                                    }));
                                                }}
                                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-ac-taupe/40 uppercase font-bold">
                                                {activeTab === 'en' ? 'Placeholder (EN)' : 'Placeholder (ES)'}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={activeTab === 'en' ? "e.g. Elegant..." : "e.g. Elegante..."}
                                                value={activeTab === 'en' ? q.placeholder : (q.placeholder_es || '')}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setLabQuestions(prev => prev.map((item, idx) => {
                                                        if (idx !== i) return item;
                                                        return activeTab === 'en'
                                                            ? { ...item, placeholder: newVal }
                                                            : { ...item, placeholder_es: newVal };
                                                    }));
                                                }}
                                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                            />
                                        </div>
                                    </div>

                                    {/* Essence Mapping Control */}
                                    <div className="pt-2 border-t border-ac-taupe/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id={`map-${i}`}
                                                checked={q.mapToEssence || false}
                                                onChange={(e) => {
                                                    const val = e.target.checked;
                                                    setLabQuestions(prev => prev.map((item, idx) => idx === i ? { ...item, mapToEssence: val } : item));
                                                }}
                                                className="w-4 h-4 accent-ac-gold cursor-pointer"
                                            />
                                            <label htmlFor={`map-${i}`} className="text-xs font-bold text-ac-taupe/80 cursor-pointer select-none">
                                                Map to Style Essence Profile
                                            </label>
                                        </div>

                                        {(q as any).mapToEssence && (
                                            <div className="pl-6 animate-in slide-in-from-top-2 fade-in duration-200">
                                                <label className="text-[10px] text-ac-taupe/40 uppercase font-bold block mb-1">Target Category</label>
                                                <select
                                                    value={(q as any).mappingCategory || 'style_words'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setLabQuestions(prev => prev.map((item, idx) => idx === i ? { ...item, mappingCategory: val } : item));
                                                    }}
                                                    className="w-full bg-ac-gold/10 border border-ac-gold/20 rounded-sm p-2 text-xs text-ac-taupe focus:outline-none focus:border-ac-gold font-bold"
                                                >
                                                    <option value="style_words">Three Style Words - Profile Title</option>
                                                    <option value="archetype">Style Archetype - Golden Words</option>
                                                    <option value="power_features">Power Features - Supporting Details</option>
                                                    <option value="color_energy">Color Energy - Supporting Details</option>
                                                </select>
                                                <p className="text-[9px] text-ac-taupe/50 mt-1 italic">
                                                    Answers to this question will dynamically appear in the User's Profile Header.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Takeaways & Resources */}
                    <div className="space-y-6">
                        {/* Takeaways */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                                    {activeTab === 'en' ? 'Key Takeaways (EN)' : 'Puntos Clave (ES)'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => activeTab === 'en' ? setTakeaways([...takeaways, '']) : setTakeawaysEs([...takeawaysEs, ''])}
                                    className="text-ac-gold hover:text-ac-olive"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {activeTab === 'en' ? (
                                    takeaways.map((t, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Key takeaway..."
                                                value={t}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTakeaways(prev => prev.map((item, idx) => idx === i ? newVal : item));
                                                }}
                                                className="flex-1 bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setTakeaways(prev => prev.filter((_, idx) => idx !== i))}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    takeawaysEs.map((t, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Punto clave..."
                                                value={t}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTakeawaysEs(prev => prev.map((item, idx) => idx === i ? newVal : item));
                                                }}
                                                className="flex-1 bg-white/40 border border-ac-gold/30 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setTakeawaysEs(prev => prev.filter((_, idx) => idx !== i))}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Resources */}
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                                Resources (PDFs)
                            </label>

                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors ${isDragActive
                                    ? 'border-ac-gold bg-ac-gold/5'
                                    : 'border-ac-taupe/20 hover:border-ac-gold/50'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <Upload size={20} className="mx-auto mb-2 text-ac-taupe/40" />
                                <p className="text-xs text-ac-taupe/60">
                                    {uploadingFile ? 'Uploading...' : 'Drop PDF'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                {resourceUrls.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/20 p-2 rounded-sm">
                                        <span className="text-xs text-ac-taupe truncate">{r.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setResourceUrls(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monetization - Only if NOT linked to a Masterclass */}
            {!formData.masterclassId && (
                <div className="p-6 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm">
                    <h3 className="font-serif text-xl text-ac-taupe border-b border-ac-taupe/10 pb-3 mb-4">
                        Monetization
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 bg-ac-taupe/5 p-4 rounded-sm border border-ac-taupe/10">
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
                                        id="gen-price-input-chapter"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const priceInput = document.getElementById('gen-price-input-chapter') as HTMLInputElement;
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
                                        // Use category as type (masterclass/course) or default to chapter
                                        const type = (formData.category === 'course' ? 'course' : 'chapter') as any;
                                        const res = await createStripeProduct(formData.title, price, type);

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
                                        className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold font-mono text-sm"
                                        placeholder="prod_..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">Stripe Price ID</label>
                                    <input
                                        type="text"
                                        value={formData.priceId}
                                        onChange={(e) => setFormData({ ...formData, priceId: e.target.value })}
                                        className="w-full bg-white/60 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold font-mono text-sm"
                                        placeholder="price_..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
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
                    {loading ? 'Saving...' : chapter ? 'Update Chapter' : 'Create Chapter'}
                </button>
            </div>
        </form >
    );
}
