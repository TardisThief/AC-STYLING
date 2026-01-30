"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, FolderOpen, Plus, Link as LinkIcon, User } from "lucide-react";
import { toast } from "sonner";

interface WardrobeSwitcherProps {
    onSelect: (wardrobe: any) => void;
    onAddWardrobe: () => void;
    selectedId?: string;
}

export default function WardrobeSwitcher({ onSelect, onAddWardrobe, selectedId }: WardrobeSwitcherProps) {
    const [wardrobes, setWardrobes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const supabase = createClient();

    useEffect(() => {
        async function fetchWardrobes() {
            setLoading(true);

            // Fetch all active wardrobes with owner info
            const { data, error } = await supabase
                .from('wardrobes')
                .select(`
                    *,
                    profiles:owner_id (full_name, email, avatar_url)
                `)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching wardrobes:", error);
            } else {
                setWardrobes(data || []);
            }
            setLoading(false);
        }

        fetchWardrobes();
    }, [supabase]);

    const filteredWardrobes = wardrobes.filter(w => {
        if (!search) return true;
        const titleMatch = w.title?.toLowerCase().includes(search.toLowerCase());
        const ownerMatch = w.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
        return titleMatch || ownerMatch;
    });

    const copyUploadLink = (token: string) => {
        const link = `${window.location.origin}/studio/upload/${token}`;
        navigator.clipboard.writeText(link);
        toast.success("Upload link copied!");
    };

    if (loading) return <div className="p-4 text-center text-ac-taupe/40 text-xs">Loading wardrobes...</div>;

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-ac-taupe/30" size={14} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white/50 border border-ac-taupe/10 rounded-sm text-xs text-ac-taupe focus:outline-none focus:border-ac-gold transition-all"
                    />
                </div>
                <button
                    onClick={onAddWardrobe}
                    className="p-2 bg-ac-taupe text-white rounded-sm hover:bg-ac-gold transition-colors"
                    title="Add Wardrobe"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredWardrobes.map((wardrobe) => (
                    <div key={wardrobe.id} className="group relative">
                        <button
                            onClick={() => onSelect(wardrobe)}
                            className={`
                                w-full flex items-center gap-3 p-3 rounded-sm transition-all text-left
                                ${selectedId === wardrobe.id
                                    ? 'bg-ac-taupe text-white shadow-md'
                                    : 'hover:bg-white/50 text-ac-taupe/70'}
                            `}
                        >
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                ${selectedId === wardrobe.id ? 'bg-white/20' : 'bg-ac-taupe/5'}
                            `}>
                                {wardrobe.profiles?.avatar_url ? (
                                    <img src={wardrobe.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <FolderOpen size={14} />
                                )}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <h4 className="text-sm font-serif truncate">
                                    {wardrobe.title}
                                </h4>
                                <p className={`text-[9px] uppercase tracking-widest font-bold opacity-40 truncate`}>
                                    {wardrobe.profiles?.full_name || 'Unassigned'}
                                </p>
                            </div>
                        </button>

                        {/* Copy Link Button (on hover) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                copyUploadLink(wardrobe.upload_token);
                            }}
                            className={`
                                absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-sm transition-all
                                ${selectedId === wardrobe.id
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-ac-taupe/5 text-ac-taupe/40 hover:bg-ac-taupe/10 hover:text-ac-taupe opacity-0 group-hover:opacity-100'}
                            `}
                            title="Copy Upload Link"
                        >
                            <LinkIcon size={12} />
                        </button>
                    </div>
                ))}

                {filteredWardrobes.length === 0 && (
                    <p className="text-center py-8 text-[10px] text-ac-taupe/40 uppercase tracking-widest">
                        No wardrobes found
                    </p>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(90, 79, 68, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(90, 79, 68, 0.2);
                }
            `}</style>
        </div>
    );
}
