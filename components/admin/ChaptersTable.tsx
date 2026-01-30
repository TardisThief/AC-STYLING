"use client";

import { Edit2, Trash2 } from "lucide-react";
import { deleteChapter } from "@/app/actions/admin/manage-chapters";
import { toast } from "sonner";

interface ChaptersTableProps {
    chapters: any[];
    onEdit: (chapter: any) => void;
    onDelete: () => void;
}

export default function ChaptersTable({ chapters, onEdit, onDelete }: ChaptersTableProps) {
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

    if (chapters.length === 0) {
        return (
            <div className="text-center py-12 text-ac-taupe/40">
                <p>No chapters yet. Create your first one above.</p>
            </div>
        );
    }

    return (
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
                    {chapters.map((chapter) => (
                        <tr key={chapter.id} className="border-b border-ac-taupe/5 hover:bg-white/20 transition-colors">
                            <td className="py-3 px-4 text-ac-taupe">{chapter.order_index}</td>
                            <td className="py-3 px-4">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${chapter.category === 'masterclass'
                                    ? 'bg-ac-olive/10 text-ac-olive'
                                    : 'bg-ac-gold/10 text-ac-gold'
                                    }`}>
                                    {chapter.category}
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
                </tbody>
            </table>
        </div>
    );
}
