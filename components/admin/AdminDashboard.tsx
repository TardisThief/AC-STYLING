"use client";

import { useState, useEffect, useRef } from "react";
import ChapterForm from "./ChapterForm";
import ChaptersTable from "./ChaptersTable";
import { getChapters } from "@/app/actions/admin/manage-chapters";

export default function AdminDashboard() {
    const [chapters, setChapters] = useState<any[]>([]);
    const [editingChapter, setEditingChapter] = useState<any | null>(null);
    const formRef = useRef<HTMLDivElement>(null);

    const loadChapters = async () => {
        const result = await getChapters();
        if (result.success) {
            setChapters(result.chapters);
        }
    };

    useEffect(() => {
        loadChapters();
    }, []);

    // Scroll to form when editing
    useEffect(() => {
        if (editingChapter && formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [editingChapter]);

    const handleSuccess = () => {
        loadChapters();
        setEditingChapter(null);
    };

    const handleEdit = (chapter: any) => {
        setEditingChapter(chapter);
    };

    return (
        <div className="space-y-12">
            {/* Chapter Form */}
            <div ref={formRef} className={`bg-white/40 backdrop-blur-md border rounded-sm p-8 transition-all ${editingChapter ? 'border-ac-gold shadow-lg' : 'border-white/30'
                }`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-2xl text-ac-taupe">
                        {editingChapter ? `Editing: ${editingChapter.title}` : 'Add New Chapter'}
                    </h2>
                    {editingChapter && (
                        <button
                            onClick={() => setEditingChapter(null)}
                            className="text-sm text-ac-taupe/60 hover:text-ac-taupe transition-colors"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
                <ChapterForm
                    chapter={editingChapter}
                    onSuccess={handleSuccess}
                    onCancel={editingChapter ? () => setEditingChapter(null) : undefined}
                />
            </div>

            {/* Chapters List */}
            <div className="bg-white/40 backdrop-blur-md border border-white/30  rounded-sm p-8">
                <h2 className="font-serif text-2xl text-ac-taupe mb-6">Existing Chapters</h2>
                <ChaptersTable
                    chapters={chapters}
                    onEdit={handleEdit}
                    onDelete={loadChapters}
                />
            </div>
        </div>
    );
}
