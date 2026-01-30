"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Tag, Sparkles, Loader2, RefreshCw, MessageSquare } from "lucide-react";
import { getStudioInboxItems, processWardrobeItem } from "@/app/actions/studio";
import { toast } from "sonner";

// Simple relative time helper to avoid date-fns dependency
function formatDistanceToNow(date: Date | string) {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export default function StudioInbox() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Filter Logic
    // const [filter, setFilter] = useState('all'); 

    useEffect(() => {
        loadInbox();
    }, []);

    const loadInbox = async () => {
        setLoading(true);
        const res = await getStudioInboxItems();
        if (res.success) {
            setItems(res.data || []);
        } else {
            toast.error("Failed to load inbox");
        }
        setLoading(false);
    };

    const handleAction = async (itemId: string, status: 'keep' | 'donate' | 'repair', metadata?: any) => {
        setProcessingId(itemId);
        try {
            const res = await processWardrobeItem(itemId, status, metadata);
            if (res.success) {
                toast.success(`Item marked as ${status}`);
                // Remove from view immediately for "Inbox Zero" feel
                setItems(prev => prev.filter(i => i.id !== itemId));
            } else {
                toast.error(res.error || "Action failed");
            }
        } catch (e) {
            toast.error("Network error");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-12 text-center text-ac-taupe/40 flex flex-col items-center gap-4"><Loader2 className="animate-spin" /> Fetching latest uploads...</div>;

    if (items.length === 0) {
        return (
            <div className="p-16 text-center border-2 border-dashed border-ac-taupe/10 rounded-sm">
                <div className="inline-block p-4 bg-ac-olive/10 rounded-full mb-4 text-ac-olive">
                    <Check size={32} />
                </div>
                <h3 className="font-serif text-2xl text-ac-taupe mb-2">You're all caught up!</h3>
                <p className="text-ac-taupe/60">No new wardrobe items in the inbox.</p>
                <button onClick={loadInbox} className="mt-6 text-xs uppercase tracking-widest text-ac-gold hover:text-ac-olive flex items-center justify-center gap-2">
                    <RefreshCw size={14} /> Refresh Feed
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="font-serif text-2xl text-ac-taupe">Inbox</h2>
                    <span className="bg-ac-gold text-white text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
                </div>
                <button onClick={loadInbox} className="text-ac-taupe/40 hover:text-ac-gold transition-colors">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                <AnimatePresence>
                    {items.map((item) => (
                        <InboxCard
                            key={item.id}
                            item={item}
                            onAction={handleAction}
                            isProcessing={processingId === item.id}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function InboxCard({ item, onAction, isProcessing }: { item: any, onAction: any, isProcessing: boolean }) {
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState(item.client_note || "");

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="group relative bg-white shadow-sm rounded-sm overflow-hidden"
        >
            {/* Image */}
            <div className="aspect-[3/4] relative">
                <img src={item.image_url} alt="Wardrobe Item" className="w-full h-full object-cover" />

                {/* Client Info Badge */}
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider text-ac-taupe border border-ac-taupe/10 shadow-sm z-10">
                    {item.profiles?.full_name?.split(' ')[0] || 'Unknown'}
                </div>

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-20">
                        <Loader2 className="animate-spin text-ac-gold" />
                    </div>
                )}

                {/* Quick Actions Overlay (Hover) */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-4 translate-y-2 group-hover:translate-y-0 duration-300">
                    <button
                        onClick={() => onAction(item.id, 'donate')}
                        className="p-3 bg-white text-ac-taupe rounded-full hover:bg-red-50 hover:text-red-500 transition-colors shadow-lg"
                        title="Donate / Purge"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={() => onAction(item.id, 'keep')}
                        className="p-3 bg-ac-gold text-white rounded-full hover:bg-ac-gold/90 transition-colors shadow-lg shadow-ac-gold/20 scale-110"
                        title="Approve & Keep"
                    >
                        <Check size={20} />
                    </button>
                    <button
                        onClick={() => setShowNotes(!showNotes)}
                        className="p-3 bg-white text-ac-taupe rounded-full hover:bg-ac-olive/10 hover:text-ac-olive transition-colors shadow-lg"
                        title="Edit Details"
                    >
                        <Tag size={18} />
                    </button>
                </div>
            </div>

            {/* Footer Info */}
            <div className="p-3 border-t border-ac-taupe/10 bg-[#fcfbf9]">
                <div className="flex justify-between items-center text-[10px] text-ac-taupe/50 uppercase tracking-wider">
                    <span>{formatDistanceToNow(new Date(item.created_at))} ago</span>
                    {item.client_note && <MessageSquare size={12} className="text-ac-gold" />}
                </div>
            </div>

            {/* Edit Drawer (Simplified) */}
            {showNotes && (
                <div className="absolute inset-0 bg-white z-30 p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-ac-taupe">Quick Edit</span>
                        <button onClick={() => setShowNotes(false)}><X size={14} /></button>
                    </div>
                    {/* Placeholder for Edit Form - For now just Tags Button? */}
                    <div className="flex-1 flex flex-col justify-center items-center text-center gap-2">
                        <p className="text-xs text-ac-taupe/60">Editing coming soon.</p>
                        <button
                            onClick={() => { onAction(item.id, 'keep', { tags: ['Edited'] }); setShowNotes(false); }}
                            className="bg-ac-taupe text-white px-3 py-1 text-xs rounded-sm"
                        >
                            Quick Keep
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
