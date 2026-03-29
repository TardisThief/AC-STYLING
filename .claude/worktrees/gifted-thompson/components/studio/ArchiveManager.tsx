"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { RefreshCw, Trash2, X, Search, Loader2, Shirt, User } from "lucide-react";
import { updateWardrobe, deleteWardrobe } from "@/app/actions/wardrobes";
import { toast } from "sonner";

interface ArchiveManagerProps {
    onClose: () => void;
    onRefresh: () => void;
    locale: string;
}

export default function ArchiveManager({ onClose, onRefresh, locale }: ArchiveManagerProps) {
    const [archivedWardrobes, setArchivedWardrobes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionId, setActionId] = useState<string | null>(null);
    const supabase = createClient();

    const fetchArchived = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('wardrobes')
            .select('*, profiles:owner_id(full_name, avatar_url)')
            .eq('status', 'archived')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error(error);
            toast.error("Failed to fetch archived wardrobes");
        } else {
            setArchivedWardrobes(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchArchived();
    }, []);

    const handleRestore = async (id: string) => {
        setActionId(id);
        const res = await updateWardrobe(id, { status: 'active' });
        if (res.success) {
            toast.success("Wardrobe restored");
            fetchArchived();
            onRefresh();
        } else {
            toast.error(res.error || "Failed to restore");
        }
        setActionId(null);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone and will remove all associated items.`)) return;

        setActionId(id);
        const res = await deleteWardrobe(id);
        if (res.success) {
            toast.success("Wardrobe permanently deleted");
            fetchArchived();
            onRefresh();
        } else {
            toast.error(res.error || "Failed to delete");
        }
        setActionId(null);
    };

    const filtered = archivedWardrobes.filter(w =>
        (w.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (w.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-white max-w-2xl w-full p-8 rounded-sm shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-ac-taupe/20 hover:text-ac-taupe transition-colors"
            >
                <X size={24} />
            </button>

            <h3 className="font-serif text-2xl text-ac-taupe mb-2">Archive Manager</h3>
            <p className="text-xs text-ac-taupe/40 uppercase tracking-widest font-bold mb-8">Manage hidden or inactive wardrobes</p>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 text-ac-taupe/30" size={14} />
                <input
                    type="text"
                    placeholder="Search archive..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm text-xs text-ac-taupe focus:outline-none focus:border-ac-gold transition-all"
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {loading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-ac-gold" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-ac-taupe/40 text-xs uppercase tracking-widest">No archived wardrobes</div>
                ) : (
                    filtered.map(wardrobe => (
                        <div key={wardrobe.id} className="flex items-center justify-between p-4 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm group hover:border-ac-taupe/20 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-ac-taupe/10 rounded-full flex items-center justify-center text-ac-taupe flex-shrink-0">
                                    {wardrobe.profiles?.avatar_url ? (
                                        <img src={wardrobe.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <Shirt size={20} />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-serif text-lg text-ac-taupe leading-tight truncate">{wardrobe.title}</h4>
                                    <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold truncate">
                                        {wardrobe.profiles?.full_name || 'Unassigned'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={() => handleRestore(wardrobe.id)}
                                    disabled={actionId === wardrobe.id}
                                    className="p-2 text-ac-taupe/40 hover:text-ac-olive hover:bg-ac-olive/10 rounded-sm transition-all"
                                    title="Restore Wardrobe"
                                >
                                    {actionId === wardrobe.id ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                </button>
                                <button
                                    onClick={() => handleDelete(wardrobe.id, wardrobe.title)}
                                    disabled={actionId === wardrobe.id}
                                    className="p-2 text-ac-taupe/40 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all"
                                    title="Permanently Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(90, 79, 68, 0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}
