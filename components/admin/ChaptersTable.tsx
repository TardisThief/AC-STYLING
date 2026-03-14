"use client";

import { useState } from "react";
import { Edit2, Trash2, Filter } from "lucide-react";
import { deleteChapter } from "@/app/actions/admin/manage-chapters";
import { toast } from "sonner";

interface ChaptersTableProps {
    chapters: any[];
    onEdit: (chapter: any) => void;
    onDelete: () => void;
}

export default function ChaptersTable({ chapters, onEdit, onDelete }: ChaptersTableProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

        const result = await deleteChapter(id);
        if (result.success) {
            toast.success('Chapter deleted');
            onDelete();
        } else {
            toast.error(result.error || 'Delete failed');
        }
    };

    // Calculate unique categories from data to ensure we catch any custom ones
    const availableCategories = Array.from(new Set(chapters.map(c => c.category))).filter(c => c !== 'masterclass' && c !== 'course');

    const filteredChapters = selectedCategory === 'all'
        ? chapters
        : chapters.filter(c => c.category === selectedCategory);

    if (chapters.length === 0) {
        return (
            <div className="text-center py-12 text-ac-taupe/40">
                <p>No chapters yet. Create your first one above.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter Controls */}
            <div className="flex items-center gap-3 p-2 border-b border-ac-taupe/5">
                <Filter size={16} className="text-ac-taupe/40" />
                <span className="text-xs font-bold text-ac-taupe/60 uppercase tracking-widest">Filter:</span>

                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white/40 border border-ac-taupe/10 rounded-sm py-1.5 px-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold cursor-pointer"
                >
                    <option value="all">All Categories</option>
                    <option value="masterclass">Masterclass</option>
                    <option value="course">Course</option>
                    {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <div className="h-4 w-px bg-ac-taupe/10 mx-2"></div>

                <span className="text-xs text-ac-taupe/40">
                    Showing <span className="font-bold text-ac-taupe/60">{filteredChapters.length}</span> results
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-ac-taupe/10">
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Order</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Category</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Title</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Slug</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Video ID</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Resources</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredChapters.map((chapter) => (
                            <tr key={chapter.id} className="border-b border-ac-taupe/5 hover:bg-white/20 transition-colors">
                                <td className="py-3 px-4 text-ac-taupe">{chapter.order_index}</td>
                                <td className="py-3 px-4">
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${chapter.category === 'masterclass'
                                        ? 'bg-ac-olive/10 text-ac-olive'
                                        : 'bg-ac-gold/10 text-ac-gold'
                                        }`}>
                                        {chapter.masterclasses?.title || chapter.category}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-ac-taupe font-serif">{chapter.title}</td>
                                <td className="py-3 px-4 text-ac-taupe/60 text-sm">{chapter.slug}</td>
                                <td className="py-3 px-4 text-ac-taupe/60 text-sm">{chapter.video_id}</td>
                                <td className="py-3 px-4 text-ac-taupe/60 text-sm">
                                    {chapter.resource_urls?.length || 0} files
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => onEdit(chapter)}
                                            className="p-2 hover:bg-ac-olive/10 rounded transition-colors text-ac-olive"
                                            title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(chapter.id, chapter.title)}
                                            className="p-2 hover:bg-red-500/10 rounded transition-colors text-red-500"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredChapters.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-12 text-ac-taupe/40 bg-ac-taupe/5 rounded-sm">
                                    No chapters found for the selected category.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
