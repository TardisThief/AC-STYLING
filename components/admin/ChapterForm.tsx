"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { createChapter, updateChapter } from "@/app/actions/admin/manage-chapters";
import { uploadFile } from "@/app/actions/admin/upload-file";
import { toast } from "sonner";

interface ChapterFormProps {
    chapter?: any;
    onSuccess: () => void;
    onCancel?: () => void;
}

export default function ChapterForm({ chapter, onSuccess, onCancel }: ChapterFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        slug: chapter?.slug || '',
        title: chapter?.title || '',
        subtitle: chapter?.subtitle || '',
        description: chapter?.description || '',
        videoId: chapter?.video_id || '',
        thumbnailUrl: chapter?.thumbnail_url || '',
        category: chapter?.category || 'masterclass',
        orderIndex: chapter?.order_index || 0,
    });

    const [labQuestions, setLabQuestions] = useState<Array<{ key: string, label: string, placeholder: string }>>(
        chapter?.lesson_metadata?.[0]?.lab_questions || []
    );
    const [takeaways, setTakeaways] = useState<string[]>(
        chapter?.lesson_metadata?.[0]?.takeaways || []
    );
    const [resourceUrls, setResourceUrls] = useState<Array<{ name: string, url: string }>>(
        chapter?.lesson_metadata?.[0]?.resource_urls || []
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
            videoId: chapter?.video_id || '',
            thumbnailUrl: chapter?.thumbnail_url || '',
            category: chapter?.category || 'masterclass',
            orderIndex: chapter?.order_index || 0,
        });
        setLabQuestions(chapter?.lesson_metadata?.[0]?.lab_questions || []);
        setTakeaways(chapter?.lesson_metadata?.[0]?.takeaways || []);
        setResourceUrls(chapter?.lesson_metadata?.[0]?.resource_urls || []);
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
        fd.append('videoId', formData.videoId);
        fd.append('thumbnailUrl', formData.thumbnailUrl);
        fd.append('category', formData.category);
        fd.append('orderIndex', formData.orderIndex.toString());
        fd.append('labQuestions', JSON.stringify(labQuestions));
        fd.append('takeaways', JSON.stringify(takeaways));
        fd.append('resourceUrls', JSON.stringify(resourceUrls));

        const result = chapter
            ? await updateChapter(chapter.id, fd)
            : await createChapter(fd);

        if (result.success) {
            toast.success(chapter ? 'Chapter updated' : 'Chapter created');
            onSuccess();
            // Reset form if creating new
            if (!chapter) {
                setFormData({ slug: '', title: '', subtitle: '', description: '', videoId: '', thumbnailUrl: '', category: 'masterclass', orderIndex: 0 });
                setLabQuestions([]);
                setTakeaways([]);
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
                                <img src={formData.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
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
                                    setFormData({ ...formData, orderIndex: val === '' ? 0 : parseInt(val) });
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

            {/* SECTION 2: Lesson Content */}
            <div className="space-y-6">
                <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-3">Lesson Content</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Video & Description */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest mb-2">
                                Vimeo ID
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
                                Full Lesson Content
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={6}
                                placeholder="Detailed description that appears under the video..."
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-3 text-ac-taupe focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold resize-none"
                            />
                        </div>
                    </div>

                    {/* Essence Lab Questions */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                                Essence Lab Questions
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
                                <div key={i} className="bg-white/20 p-3 rounded-sm space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-ac-taupe/60">Q{i + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => setLabQuestions(labQuestions.filter((_, idx) => idx !== i))}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Key: style_words"
                                        value={q.key}
                                        onChange={(e) => {
                                            const updated = [...labQuestions];
                                            updated[i].key = e.target.value;
                                            setLabQuestions(updated);
                                        }}
                                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Label: My Style Words"
                                        value={q.label}
                                        onChange={(e) => {
                                            const updated = [...labQuestions];
                                            updated[i].label = e.target.value;
                                            setLabQuestions(updated);
                                        }}
                                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Placeholder..."
                                        value={q.placeholder}
                                        onChange={(e) => {
                                            const updated = [...labQuestions];
                                            updated[i].placeholder = e.target.value;
                                            setLabQuestions(updated);
                                        }}
                                        className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                    />
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
                                    Key Takeaways
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setTakeaways([...takeaways, ''])}
                                    className="text-ac-gold hover:text-ac-olive"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {takeaways.map((t, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Key takeaway..."
                                            value={t}
                                            onChange={(e) => {
                                                const updated = [...takeaways];
                                                updated[i] = e.target.value;
                                                setTakeaways(updated);
                                            }}
                                            className="flex-1 bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setTakeaways(takeaways.filter((_, idx) => idx !== i))}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
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
                                            onClick={() => setResourceUrls(resourceUrls.filter((_, idx) => idx !== i))}
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
        </form>
    );
}
