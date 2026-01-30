"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Layout, Eye, EyeOff, Download, ExternalLink, Image as ImageIcon, Loader2, Save, Trash2, Copy, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface DigitalLookbookProps {
    clientId: string;
}

export default function DigitalLookbook({ clientId }: DigitalLookbookProps) {
    const [lookbooks, setLookbooks] = useState<any[]>([]);
    const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeLookbook, setActiveLookbook] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);

    // New Lookbook State
    const [newTitle, setNewTitle] = useState("");
    const [newCollection, setNewCollection] = useState("");

    // Clone Lookbook State
    const [isCloning, setIsCloning] = useState(false);
    const [targetClient, setTargetClient] = useState("");
    const [allClients, setAllClients] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const [lookbooksRes, wardrobeRes] = await Promise.all([
                supabase.from('lookbooks')
                    .select('*, lookbook_items(item_id)')
                    .eq('wardrobe_id', clientId)
                    .order('created_at', { ascending: false }),
                supabase.from('wardrobe_items').select('*').eq('wardrobe_id', clientId)
            ]);

            setLookbooks(lookbooksRes.data || []);
            setWardrobeItems(wardrobeRes.data || []);

            // Fetch potential clone targets (other wardrobes)
            const { data: wardrobes } = await supabase.from('wardrobes').select('id, title').neq('id', clientId);
            setAllClients(wardrobes || []);

            setLoading(false);
        }

        loadData();
    }, [clientId, supabase]);

    const handleCreateLookbook = async () => {
        if (!newTitle) return toast.error("Please provide a title");

        const { data, error } = await supabase
            .from('lookbooks')
            .insert({
                wardrobe_id: clientId,
                title: newTitle,
                collection_name: newCollection,
                status: 'Draft'
            })
            .select()
            .single();

        if (error) {
            toast.error("Failed to create lookbook");
        } else {
            setLookbooks([data, ...lookbooks]);
            setActiveLookbook({ ...data, lookbook_items: [] });
            setIsCreating(false);
            setNewTitle("");
            setNewCollection("");
            toast.success("New lookbook created");
        }
    };

    const handleToggleItem = async (itemId: string) => {
        try {
            if (!activeLookbook) return;

            const currentItems = activeLookbook.lookbook_items || [];
            const isCurrentlySelected = currentItems.some((i: any) => i.item_id === itemId);

            if (isCurrentlySelected) {
                // Remove
                const { error } = await supabase
                    .from('lookbook_items')
                    .delete()
                    .eq('lookbook_id', activeLookbook.id)
                    .eq('item_id', itemId);

                if (error) throw error;

                setActiveLookbook({
                    ...activeLookbook,
                    lookbook_items: currentItems.filter((i: any) => i.item_id !== itemId)
                });
            } else {
                // Add
                const { error } = await supabase
                    .from('lookbook_items')
                    .insert({
                        lookbook_id: activeLookbook.id,
                        item_id: itemId
                    });

                if (error) throw error;

                setActiveLookbook({
                    ...activeLookbook,
                    lookbook_items: [...currentItems, { item_id: itemId }]
                });
            }
        } catch (err) {
            console.error("Error toggling item:", err);
            toast.error("Failed to update lookbook item");
        }
    };

    const handleToggleStatus = async () => {
        if (!activeLookbook) return;
        const newStatus = activeLookbook.status === 'Draft' ? 'Published' : 'Draft';

        const { error } = await supabase
            .from('lookbooks')
            .update({ status: newStatus })
            .eq('id', activeLookbook.id);

        if (!error) {
            setActiveLookbook({ ...activeLookbook, status: newStatus });
            setLookbooks(prev => prev.map(lb => lb.id === activeLookbook.id ? { ...lb, status: newStatus } : lb));
            toast.success(`Lookbook ${newStatus}`);
        }
    };

    const handleDeleteLookbook = async () => {
        if (!confirm("Are you sure you want to delete this lookbook?")) return;

        const { error } = await supabase
            .from('lookbooks')
            .delete()
            .eq('id', activeLookbook.id);

        if (!error) {
            setLookbooks(prev => prev.filter(lb => lb.id !== activeLookbook.id));
            setActiveLookbook(null);
            toast.success("Lookbook deleted");
        }
    };

    const handleCloneLookbook = async () => {
        if (!activeLookbook || !targetClient) return toast.error("Please select a target client.");

        setIsSaving(true);
        try {
            const { error, data } = await supabase.rpc('clone_lookbook', {
                lookbook_id: activeLookbook.id,
                target_profile_id: targetClient
            });

            if (error) throw error;

            toast.success(`Lookbook cloned to ${allClients.find(c => c.id === targetClient)?.full_name || 'client'}!`);
            setIsCloning(false);
            setTargetClient("");
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to clone lookbook: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadAssets = () => {
        if (!activeLookbook || !activeLookbook.lookbook_items?.length) return;

        // Simple implementation: Open all images in new tabs for Ale to "Save As" 
        // OR in a production environment, generate a ZIP on the server/client.
        // For now, let's notify the user about the download intent.

        const itemsToDownload = wardrobeItems.filter(wi =>
            activeLookbook.lookbook_items.some((li: any) => li.item_id === wi.id)
        );

        itemsToDownload.forEach(item => {
            const link = document.createElement('a');
            link.href = item.image_url;
            link.download = `item-${item.id}.jpg`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        toast.success(`Attempting to download ${itemsToDownload.length} assets`);
    };

    if (loading) return <div className="p-8 text-center text-ac-taupe/40">Loading Lookbooks...</div>;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Lookbook List */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-serif text-xl text-ac-taupe">Collections</h3>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="p-2 bg-ac-taupe text-white rounded-sm hover:bg-ac-taupe/90 transition-all shadow-md"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <AnimatePresence mode="popLayout">
                        {isCreating && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white/80 backdrop-blur-md border border-ac-gold p-6 rounded-sm shadow-xl space-y-4 mb-4"
                            >
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Title (e.g. Paris Trip)"
                                    className="w-full bg-white/50 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                />
                                <input
                                    type="text"
                                    value={newCollection}
                                    onChange={(e) => setNewCollection(e.target.value)}
                                    placeholder="Collection (e.g. Winter '26)"
                                    className="w-full bg-white/50 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                />
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleCreateLookbook}
                                        className="flex-1 bg-ac-taupe text-white py-2 rounded-sm text-xs font-bold uppercase tracking-widest"
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="px-4 py-2 border border-ac-taupe/10 rounded-sm text-xs text-ac-taupe/60"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2">
                        {lookbooks.map((lb) => (
                            <button
                                key={lb.id}
                                onClick={() => setActiveLookbook(lb)}
                                className={`
                                    w-full p-4 rounded-sm border transition-all text-left group
                                    ${activeLookbook?.id === lb.id
                                        ? 'bg-white border-ac-gold shadow-md'
                                        : 'bg-white/40 border-white/50 hover:border-ac-taupe/20'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-serif text-lg text-ac-taupe group-hover:text-ac-gold transition-colors">{lb.title}</h4>
                                    {lb.status === 'Published' ? (
                                        <Eye size={12} className="text-ac-olive" />
                                    ) : (
                                        <EyeOff size={12} className="text-ac-taupe/20" />
                                    )}
                                </div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-ac-taupe/40">
                                    {lb.collection_name || 'Generic Collection'} • {lb.lookbook_items?.length || 0} Items
                                </p>
                            </button>
                        ))}

                        {lookbooks.length === 0 && !isCreating && (
                            <div className="text-center py-12 border-2 border-dashed border-ac-taupe/10 rounded-sm">
                                <Layout className="mx-auto text-ac-taupe/10 mb-4" size={32} />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/30">No collections yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Builder Canvas */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {activeLookbook ? (
                            <motion.div
                                key={activeLookbook.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-8 shadow-sm h-full flex flex-col"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-ac-taupe/10 pb-6">
                                    <div>
                                        <h3 className="font-serif text-3xl text-ac-taupe">{activeLookbook.title}</h3>
                                        <p className="text-xs uppercase tracking-widest text-ac-taupe/40 font-bold mt-1">
                                            Exploring designs for {activeLookbook.collection_name || 'this capsule'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setIsCloning(true)}
                                            className="p-2 bg-ac-taupe/5 text-ac-taupe rounded-sm hover:bg-ac-gold hover:text-white transition-all border border-ac-taupe/10"
                                            title="Clone to another client"
                                        >
                                            <Copy size={18} />
                                        </button>

                                        <button
                                            onClick={handleToggleStatus}
                                            className={`
                                                flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all
                                                ${activeLookbook.status === 'Published' ? 'bg-ac-olive text-white' : 'bg-ac-taupe/10 text-ac-taupe'}
                                            `}
                                        >
                                            {activeLookbook.status === 'Published' ? <Eye size={14} /> : <EyeOff size={14} />}
                                            {activeLookbook.status}
                                        </button>

                                        <button
                                            onClick={handleDownloadAssets}
                                            className="p-2 bg-ac-taupe/5 text-ac-taupe rounded-sm hover:bg-ac-taupe/10 transition-all border border-ac-taupe/10"
                                            title="Download all item images"
                                        >
                                            <Download size={18} />
                                        </button>

                                        <a
                                            href="https://www.canva.com"
                                            target="_blank"
                                            className="p-2 bg-[#00C4CC] text-white rounded-sm hover:opacity-90 transition-all shadow-md"
                                            title="Design in Canva"
                                        >
                                            <ExternalLink size={18} />
                                        </a>

                                        <button
                                            onClick={handleDeleteLookbook}
                                            className="p-2 text-red-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                                    {/* Selected Items */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Lookbook Canvas</h4>
                                        <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                            {wardrobeItems.filter(wi =>
                                                activeLookbook.lookbook_items?.some((li: any) => li.item_id === wi.id)
                                            ).map((item) => (
                                                <div key={item.id} className="aspect-[3/4] relative group rounded-sm overflow-hidden border border-white/50">
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={() => handleToggleItem(item.id)}
                                                        className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 font-bold uppercase text-[10px]"
                                                    >
                                                        <Trash2 size={14} />
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            {(!activeLookbook.lookbook_items || activeLookbook.lookbook_items.length === 0) && (
                                                <div className="aspect-[3/4] border-2 border-dashed border-ac-taupe/10 flex flex-col items-center justify-center text-ac-taupe/20 p-4 text-center">
                                                    <Plus size={24} strokeWidth={1} />
                                                    <p className="text-[8px] uppercase tracking-tighter mt-2">Add items from wardrobe</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Wardrobe Selector */}
                                    <div className="bg-ac-taupe/5 rounded-sm p-6 flex flex-col">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-4">Add from Wardrobe</h4>
                                        <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[440px] pr-2 custom-scrollbar">
                                            {wardrobeItems.map((item) => {
                                                const isSelected = activeLookbook.lookbook_items?.some((i: any) => i.item_id === item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleToggleItem(item.id)}
                                                        className={`
                                                            aspect-square relative rounded-sm overflow-hidden border-2 transition-all
                                                            ${isSelected ? 'border-ac-gold' : 'border-transparent opacity-60 hover:opacity-100'}
                                                        `}
                                                    >
                                                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                        {isSelected && (
                                                            <div className="absolute inset-0 bg-ac-gold/20 flex items-center justify-center">
                                                                <Check size={16} className="text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="bg-white/20 border-2 border-dashed border-ac-taupe/10 rounded-sm p-12 text-center h-full flex flex-col items-center justify-center">
                                <Layout className="text-ac-taupe/10 mb-4" size={60} strokeWidth={1} />
                                <h3 className="font-serif text-2xl text-ac-taupe/40 mb-2">Select a Collection</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/30">to start building outfits</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Clone Lookbook Modal */}
            <AnimatePresence>
                {isCloning && activeLookbook && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/80 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white max-w-md w-full rounded-sm shadow-xl overflow-hidden relative"
                        >
                            <button
                                onClick={() => {
                                    setIsCloning(false);
                                    setTargetClient("");
                                }}
                                className="absolute top-4 right-4 z-50 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="p-6 border-b border-ac-taupe/10">
                                <h3 className="font-serif text-xl text-ac-taupe">Clone Collection</h3>
                                <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold mt-1">Copy "{activeLookbook.title}" to another client</p>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Target Client</label>
                                    <select
                                        value={targetClient}
                                        onChange={(e) => setTargetClient(e.target.value)}
                                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                    >
                                        <option value="">-- Select Client --</option>
                                        {allClients.map(client => (
                                            <option key={client.id} value={client.id}>
                                                {client.full_name || 'Unnamed Client'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-ac-taupe/5 p-4 rounded-sm text-[11px] text-ac-taupe/60 italic">
                                    <p>This will create a copy of the lookbook and duplicate all its items into the target client's wardrobe.</p>
                                </div>

                                <button
                                    onClick={handleCloneLookbook}
                                    disabled={isSaving || !targetClient}
                                    className="w-full bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-ac-taupe transition-all disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <div className="flex items-center gap-2"><Copy size={14} /> <span>Duplicate Collection</span></div>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
            `}</style>
        </div>
    );
}

function Check({ size, className }: { size: number, className: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}
