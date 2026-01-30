"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Check, Loader2, AlertCircle } from "lucide-react";
import { searchProfiles, assignWardrobe } from "@/app/actions/wardrobes";
import { toast } from "sonner";

interface UserAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    wardrobeId: string;
    wardrobeTitle: string;
}

export default function UserAssignmentModal({ isOpen, onClose, wardrobeId, wardrobeTitle }: UserAssignmentModalProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [assigning, setAssigning] = useState<string | null>(null); // ID of user being assigned

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length >= 2) {
                setSearching(true);
                const { profiles, error } = await searchProfiles(query);
                if (error) {
                    toast.error("Search failed");
                } else {
                    setResults(profiles || []);
                }
                setSearching(false);
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleAssign = async (user: any) => {
        if (!confirm(`Are you sure you want to assign "${wardrobeTitle}" to ${user.full_name}? This will enable Studio access for them.`)) {
            return;
        }

        setAssigning(user.id);
        const { success, error } = await assignWardrobe(wardrobeId, user.id);

        if (success) {
            toast.success(`Wardrobe assigned to ${user.full_name}`);
            onClose();
        } else {
            toast.error(error || "Assignment failed");
        }
        setAssigning(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-md rounded-sm shadow-xl overflow-hidden border border-white/20"
                    >
                        {/* Header */}
                        <div className="bg-ac-taupe p-4 flex items-center justify-between text-white">
                            <div>
                                <h3 className="font-serif text-lg">Assign Wardrobe</h3>
                                <p className="text-xs opacity-60">Assigning "{wardrobeTitle}"</p>
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-ac-taupe/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ac-taupe/40" size={16} />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search users by name..."
                                    className="w-full pl-10 pr-4 py-2 border border-ac-taupe/20 rounded-sm text-sm focus:outline-none focus:border-ac-gold transition-colors"
                                    autoFocus
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="animate-spin text-ac-gold" size={16} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results */}
                        <div className="max-h-60 overflow-y-auto">
                            {results.length > 0 ? (
                                <div className="divide-y divide-ac-taupe/5">
                                    {results.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleAssign(user)}
                                            disabled={!!assigning}
                                            className="w-full p-4 flex items-center gap-3 hover:bg-ac-gold/5 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-ac-taupe/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={14} className="text-ac-taupe/60" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-ac-taupe truncate">{user.full_name}</p>
                                                <p className="text-xs text-ac-taupe/40 truncate">{user.email}</p>
                                            </div>
                                            {assigning === user.id ? (
                                                <Loader2 className="animate-spin text-ac-gold" size={16} />
                                            ) : (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold text-ac-gold uppercase tracking-wider">
                                                    <span>Assign</span>
                                                    <Check size={14} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : query.length >= 2 && !searching ? (
                                <div className="p-8 text-center text-ac-taupe/40">
                                    <div className="inline-block p-3 bg-ac-taupe/5 rounded-full mb-3">
                                        <User size={24} className="opacity-50" />
                                    </div>
                                    <p className="text-sm">No users found.</p>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-ac-taupe/40">
                                    <p className="text-xs uppercase tracking-widest">Type to search users</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="p-3 bg-ac-taupe/5 border-t border-ac-taupe/10 flex gap-2 items-start">
                            <AlertCircle className="text-ac-gold shrink-0 mt-0.5" size={14} />
                            <p className="text-[10px] text-ac-taupe/60 leading-tight">
                                Assigning a wardrobe will automatically unlock Studio access for the selected user.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
