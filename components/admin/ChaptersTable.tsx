"use client";

import { useState } from "react";
import type { Chapter } from "@/app/lib/types";
import { Edit2, Trash2, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { deleteChapter } from "@/app/actions/admin/manage-chapters";
import { toast } from "sonner";

interface ChaptersTableProps {
    chapters: Chapter[];
    onEdit: (chapter: Chapter) => void;
    onDelete: () => void;
}

type SortField = 'order_index' | 'category' | 'title' | 'slug' | 'video_id' | 'resources';
type SortDirection = 'asc' | 'desc';

export default function ChaptersTable({ chapters, onEdit, onDelete }: ChaptersTableProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('category');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

    // Supabase to-one join may arrive as object or single-element array.
    const mcTitleOf = (c: Chapter): string | undefined => {
        const m = Array.isArray(c.masterclasses) ? c.masterclasses[0] : c.masterclasses;
        return m?.title;
    };

    // Calculate unique categories from data to ensure we catch any custom ones.
    // Also use the assigned masterclass title if category is masterclass.
    const availableCategories = Array.from(
        new Set(chapters.map(c => mcTitleOf(c) || c.category).filter((v): v is string => !!v))
    ).sort();

    let filteredChapters = selectedCategory === 'all'
        ? chapters
        : chapters.filter(c => (mcTitleOf(c) || c.category) === selectedCategory);

    const getSortValue = (chapter: Chapter, field: SortField) => {
        if (field === 'category') {
            return mcTitleOf(chapter) || chapter.category || '';
        }
        if (field === 'resources') {
            return chapter.resource_urls?.length || 0;
        }
        return chapter[field] || '';
    };

    filteredChapters = [...filteredChapters].sort((a, b) => {
        const valueA = getSortValue(a, sortField);
        const valueB = getSortValue(b, sortField);

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortHeader = ({ field, label }: { field: SortField, label: string }) => (
        <th 
            className="text-left py-3 px-4 text-xs font-bold text-ac-taupe/80 uppercase tracking-widest cursor-pointer hover:bg-ac-taupe/5 transition-colors select-none"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (
                    sortDirection === 'asc' ? <ChevronUp size={14} className="text-ac-gold" /> : <ChevronDown size={14} className="text-ac-gold" />
                )}
            </div>
        </th>
    );

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
                            <SortHeader field="order_index" label="Order" />
                            <SortHeader field="category" label="Category" />
                            <SortHeader field="title" label="Title" />
                            <SortHeader field="slug" label="Slug" />
                            <SortHeader field="video_id" label="Video ID" />
                            <SortHeader field="resources" label="Resources" />
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
                                        {mcTitleOf(chapter) || chapter.category}
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
