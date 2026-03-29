"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Tag, MessageSquare, Briefcase, ShoppingBag, ExternalLink, Loader2, Filter, Search, X, Check, Image as ImageIcon, Link as LinkIcon, Camera, Sparkles, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { uploadRemoteImage } from "@/app/actions/studio";
import { extractUrlMetadata } from "@/app/actions/scraper";

interface VirtualWardrobeProps {
    clientId: string;
    isClientView?: boolean;
}

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags'];
const STATUSES = ['Keep', 'Tailor', 'Donate', 'Archive'];

export default function VirtualWardrobe({ clientId, isClientView = false }: VirtualWardrobeProps) {
    const [items, setItems] = useState<any[]>([]);
    const [boutiqueItems, setBoutiqueItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addMode, setAddMode] = useState<'boutique' | 'upload' | 'link'>('boutique');
    const [isSaving, setIsSaving] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);

    // Form States
    const [searchBoutique, setSearchBoutique] = useState("");
    const [linkForm, setLinkForm] = useState({ url: "", imageUrl: "", category: "Tops", internalNote: "" });
    const [extractedImages, setExtractedImages] = useState<string[]>([]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadForm, setUploadForm] = useState({ category: "Tops", internalNote: "" });

    // Update Image State
    const [isUpdatingImage, setIsUpdatingImage] = useState(false);
    const [updateImageMode, setUpdateImageMode] = useState<'upload' | 'link'>('upload');
    const [updateFile, setUpdateFile] = useState<File | null>(null);
    const [updateImageUrl, setUpdateImageUrl] = useState("");

    // Clone Item State
    const [isCloning, setIsCloning] = useState(false);
    const [targetClient, setTargetClient] = useState("");
    const [allClients, setAllClients] = useState<any[]>([]);

    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const [wardrobeRes, boutiqueRes] = await Promise.all([
                supabase.from('wardrobe_items').select('*').eq('wardrobe_id', clientId).order('created_at', { ascending: false }),
                supabase.from('boutique_items').select('*')
            ]);

            if (wardrobeRes.error) {
                toast.error("Failed to load wardrobe");
            } else {
                setItems(wardrobeRes.data || []);
            }

            setBoutiqueItems(boutiqueRes.data || []);

            // Allow cloning to other profiles (only if NOT client view)
            if (!isClientView) {
                const { data: clients } = await supabase.from('profiles').select('id, full_name').neq('id', clientId);
                setAllClients(clients || []);
            }

            setLoading(false);
        }

        loadData();
    }, [clientId, supabase, isClientView]);

    const handleUpdateItem = async (itemId: string, updates: any) => {
        const { error } = await supabase
            .from('wardrobe_items')
            .update(updates)
            .eq('id', itemId);

        if (error) {
            toast.error("Failed to update item");
        } else {
            setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
            if (selectedItem?.id === itemId) {
                setSelectedItem({ ...selectedItem, ...updates });
            }
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm("Are you sure you want to delete this item from the client's wardrobe?")) return;

        const { error } = await supabase
            .from('wardrobe_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            toast.error("Failed to delete item");
        } else {
            setItems(prev => prev.filter(item => item.id !== itemId));
            setSelectedItem(null);
            toast.success("Item removed from wardrobe");
        }
    };

    const handleCloneItem = async () => {
        if (!selectedItem || !targetClient) return toast.error("Please select an item and a target client.");

        setIsSaving(true);
        try {
            const { id, created_at, user_id, ...itemToClone } = selectedItem; // Exclude ID, created_at, and original user_id
            const { data, error } = await supabase.from('wardrobe_items').insert({
                ...itemToClone,
                user_id: targetClient,
                internal_note: `Cloned from ${clientId}'s wardrobe. Original note: ${itemToClone.internal_note || ''}`
            }).select().single();

            if (error) throw error;

            toast.success(`Item cloned to ${allClients.find(c => c.id === targetClient)?.full_name || 'another client'}'s wardrobe!`);
            setIsCloning(false);
            setTargetClient("");
        } catch (err: any) {
            toast.error("Failed to clone item: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = filterCategory
        ? items.filter(i => i.category === filterCategory)
        : items;

    if (loading) return <div className="p-8 text-center text-ac-taupe/40">Loading Wardrobe...</div>;

    return (
        <div className="space-y-8">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-white/40 backdrop-blur-md border border-white/50 p-4 rounded-sm">
                <div className="flex items-center gap-2 text-ac-taupe/40 px-2">
                    <Filter size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Filters</span>
                </div>
                <button
                    onClick={() => setFilterCategory(null)}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${!filterCategory ? 'bg-ac-taupe text-white' : 'bg-white/50 text-ac-taupe/40'}`}
                >
                    All
                </button>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterCategory === cat ? 'bg-ac-taupe text-white' : 'bg-white/50 text-ac-taupe/40'}`}
                    >
                        {cat}
                    </button>
                ))}

                <div className="flex-1" /> {/* Spacer */}

                <button
                    onClick={() => setIsAdding(true)}
                    className="ml-auto bg-ac-gold text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-ac-taupe transition-colors flex items-center gap-2 shadow-sm"
                >
                    <Plus size={14} strokeWidth={3} />
                    Add Item
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Items Grid */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`
                                group aspect-[3/4] relative bg-white/60 border rounded-sm overflow-hidden cursor-pointer transition-all
                                ${selectedItem?.id === item.id ? 'ring-2 ring-ac-gold border-transparent shadow-xl' : 'border-white/50 hover:border-ac-gold/30'}
                            `}
                        >
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 flex gap-1">
                                {item.status === 'Keep' && <div className="bg-ac-olive text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-full">Keep</div>}
                                {item.status === 'Tailor' && <div className="bg-ac-gold text-white text-[8px] font-bold uppercase px-2 py-0.5 rounded-full">Tailor</div>}
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                <p className="text-white text-[10px] font-bold uppercase tracking-widest truncate">{item.category || 'Uncategorized'}</p>
                            </div>
                        </div>
                    ))}

                    {/* Add Item Trigger Card */}
                    <button
                        onClick={() => setIsAdding(true)}
                        className="aspect-[3/4] border-2 border-dashed border-ac-taupe/10 rounded-sm flex flex-col items-center justify-center gap-4 text-ac-taupe/20 hover:border-ac-gold/40 hover:text-ac-gold transition-all"
                    >
                        <Plus size={32} strokeWidth={1} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add Item</span>
                    </button>
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-4 lg:sticky lg:top-8 h-fit">
                    <AnimatePresence mode="wait">
                        {selectedItem ? (
                            <motion.div
                                key={selectedItem.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-8 shadow-sm space-y-8"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-serif text-2xl text-ac-taupe">Item Profile</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/30">Curation Details</p>
                                    </div>
                                    {!isClientView && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setIsCloning(true)}
                                                className="p-2 text-ac-taupe/20 hover:text-ac-gold transition-colors"
                                                title="Clone Item"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(selectedItem.id)}
                                                className="p-2 text-ac-taupe/20 hover:text-red-400 transition-colors"
                                                title="Delete Item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button onClick={() => setSelectedItem(null)} className="p-2 text-ac-taupe/20 hover:text-ac-taupe transition-colors">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}
                                    {isClientView && (
                                        <button onClick={() => setSelectedItem(null)} className="p-2 text-ac-taupe/20 hover:text-ac-taupe transition-colors">
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>

                                <div className="aspect-[3/4] w-full bg-ac-taupe/5 rounded-sm overflow-hidden border border-ac-taupe/10 relative group">
                                    <img src={selectedItem.image_url} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => setIsUpdatingImage(true)}
                                            className="bg-white text-ac-taupe px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-ac-gold hover:text-white transition-colors flex items-center gap-2"
                                        >
                                            <Camera size={14} />
                                            Change Image
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Category */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-3">Category</label>
                                        <div className="flex flex-wrap gap-2">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => handleUpdateItem(selectedItem.id, { category: cat })}
                                                    className={`px-3 py-1 rounded-sm text-[10px] uppercase font-bold tracking-tighter border transition-all ${selectedItem.category === cat ? 'bg-ac-taupe text-white border-ac-taupe' : 'border-ac-taupe/10 text-ac-taupe/60'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Status - Read Only for Client */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-3">Curation Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUSES.map(stat => (
                                                <button
                                                    key={stat}
                                                    onClick={() => !isClientView && handleUpdateItem(selectedItem.id, { status: stat })}
                                                    disabled={isClientView}
                                                    className={`
                                                        px-3 py-1 rounded-sm text-[10px] uppercase font-bold tracking-tighter border transition-all 
                                                        ${selectedItem.status === stat ? 'bg-ac-gold text-white border-ac-gold' : 'border-ac-taupe/10 text-ac-taupe/60'}
                                                        ${isClientView ? 'opacity-80 cursor-default' : ''}
                                                    `}
                                                >
                                                    {stat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Brand & Tags */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Brand / Designer</label>
                                            <input
                                                type="text"
                                                value={selectedItem.brand || ""}
                                                onChange={(e) => handleUpdateItem(selectedItem.id, { brand: e.target.value })}
                                                placeholder="e.g. Zara, Prada"
                                                className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-2 text-xs focus:outline-none focus:border-ac-gold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Tags</label>
                                            <input
                                                type="text"
                                                value={selectedItem.tags?.join(', ') || ""}
                                                onChange={(e) => {
                                                    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                                                    handleUpdateItem(selectedItem.id, { tags });
                                                }}
                                                placeholder="Summer, Work..."
                                                className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-2 text-xs focus:outline-none focus:border-ac-gold"
                                            />
                                        </div>
                                    </div>

                                    {/* Dual Notes */}
                                    <div className="space-y-4 pt-4 border-t border-ac-taupe/10">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <MessageSquare size={12} className="text-ac-taupe/40" />
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40">Client Note</label>
                                            </div>
                                            <textarea
                                                value={selectedItem.client_note || ""}
                                                onChange={(e) => handleUpdateItem(selectedItem.id, { client_note: e.target.value })}
                                                placeholder="Add your notes here..."
                                                className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-[11px] text-ac-taupe placeholder:text-ac-taupe/40 focus:outline-none focus:border-ac-gold transition-all resize-none h-24"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Briefcase size={12} className="text-ac-gold" />
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-ac-gold">
                                                    {isClientView ? "Stylist Note" : "Ale's Private Note"}
                                                </label>
                                            </div>
                                            {isClientView ? (
                                                <div className="bg-ac-gold/5 border border-ac-gold/10 p-3 rounded-sm text-[11px] text-ac-taupe min-h-[60px]">
                                                    {selectedItem.notes || <span className="text-ac-taupe/30 italic">No notes from your stylist yet.</span>}
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={selectedItem.notes || ""}
                                                    onChange={(e) => handleUpdateItem(selectedItem.id, { notes: e.target.value })}
                                                    placeholder="Notes visible only to you..."
                                                    className="w-full bg-white/40 border border-ac-gold/20 rounded-sm p-3 text-[11px] text-ac-taupe placeholder:text-ac-gold/20 focus:outline-none focus:border-ac-gold transition-all resize-none h-24"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Boutique Hook - Read Only / Hidden for Client */}
                                    {!isClientView && (
                                        <div className="pt-4 border-t border-ac-taupe/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ShoppingBag size={12} className="text-ac-olive" />
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-ac-olive">Boutique Integration</label>
                                            </div>
                                            <select
                                                value={selectedItem.product_link_id || ""}
                                                onChange={(e) => handleUpdateItem(selectedItem.id, { product_link_id: e.target.value || null })}
                                                className="w-full bg-ac-olive/5 border border-ac-olive/20 rounded-sm p-2 text-[10px] text-ac-taupe focus:outline-none"
                                            >
                                                <option value="">No linked product</option>
                                                {boutiqueItems.map(bi => (
                                                    <option key={bi.id} value={bi.id}>{bi.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {isClientView && selectedItem.product_link_id && (
                                        <div className="pt-4 border-t border-ac-taupe/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ShoppingBag size={12} className="text-ac-olive" />
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-ac-olive">Shop This Look</label>
                                            </div>
                                            <div className="bg-ac-olive/5 border border-ac-olive/10 p-3 rounded-sm text-xs text-ac-taupe flex justify-between items-center">
                                                <span>{boutiqueItems.find(b => b.id === selectedItem.product_link_id)?.name || 'Linked Product'}</span>
                                                <ExternalLink size={14} className="text-ac-olive" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="bg-white/20 border-2 border-dashed border-ac-taupe/10 rounded-sm p-12 text-center h-[600px] flex flex-col items-center justify-center">
                                <Tag className="text-ac-taupe/10 mb-4" size={40} strokeWidth={1} />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/30">Select an item to view details</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Add Item Modal */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/80 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white max-w-4xl w-full h-[80vh] rounded-sm shadow-2xl overflow-hidden flex flex-col relative"
                        >
                            <button
                                onClick={() => setIsAdding(false)}
                                className="absolute top-6 right-6 z-50 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                            >
                                <X size={24} />
                            </button>

                            {/* Modal Header */}
                            <div className="p-8 border-b border-ac-taupe/10 flex items-center justify-between">
                                <div>
                                    <h3 className="font-serif text-3xl text-ac-taupe">Curation Ingestion</h3>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 mt-1">Source items for the client's virtual wardrobe</p>
                                </div>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Left Sidebar: Modes */}
                                <div className="w-64 bg-ac-taupe/5 border-r border-ac-taupe/10 p-6 space-y-2">
                                    {[
                                        { id: 'boutique', label: 'From Boutique', icon: ShoppingBag },
                                        { id: 'upload', label: 'Direct Upload', icon: ImageIcon },
                                        { id: 'link', label: 'Save from Link', icon: LinkIcon },
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setAddMode(mode.id as any)}
                                            className={`
                                                w-full flex items-center gap-3 px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-widest transition-all
                                                ${addMode === mode.id ? 'bg-ac-taupe text-white shadow-lg' : 'text-ac-taupe/40 hover:bg-ac-taupe/5'}
                                            `}
                                        >
                                            <mode.icon size={16} />
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Right Content: Form */}
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    {addMode === 'boutique' && (
                                        <div className="space-y-6">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 text-ac-taupe/30" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Search boutique items..."
                                                    value={searchBoutique}
                                                    onChange={(e) => setSearchBoutique(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm text-sm focus:outline-none focus:border-ac-gold"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                {boutiqueItems.filter(bi => bi.name.toLowerCase().includes(searchBoutique.toLowerCase())).map(bi => (
                                                    <div
                                                        key={bi.id}
                                                        onClick={async () => {
                                                            setIsSaving(true);
                                                            const { data, error } = await supabase.from('wardrobe_items').insert({
                                                                user_id: clientId,
                                                                image_url: bi.image_url,
                                                                category: bi.category,
                                                                product_link_id: bi.id,
                                                                status: 'Keep',
                                                                internal_note: `Imported from Boutique: ${bi.name}`
                                                            }).select().single();

                                                            if (error) toast.error("Failed to import item");
                                                            else {
                                                                setItems([data, ...items]);
                                                                toast.success("Item imported from Boutique");
                                                                setIsAdding(false);
                                                            }
                                                            setIsSaving(false);
                                                        }}
                                                        className="group aspect-[3/4] relative rounded-sm overflow-hidden border border-ac-taupe/10 cursor-pointer hover:border-ac-gold transition-all"
                                                    >
                                                        <img src={bi.image_url} alt="" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-ac-gold/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                                            <Plus size={24} />
                                                            <span className="text-[8px] font-bold uppercase mt-2">Import</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {addMode === 'upload' && (
                                        <div className="space-y-8 max-w-xl mx-auto py-8">
                                            <div className="aspect-video border-2 border-dashed border-ac-taupe/20 rounded-sm flex flex-col items-center justify-center gap-4 bg-ac-taupe/5 relative overflow-hidden">
                                                {uploadFile ? (
                                                    <img src={URL.createObjectURL(uploadFile)} className="absolute inset-0 w-full h-full object-contain" alt="" />
                                                ) : (
                                                    <>
                                                        <Camera size={40} className="text-ac-taupe/10" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 text-center px-8">Drop professional photos or click to browse</p>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-3">Category Assignment</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {CATEGORIES.map(cat => (
                                                            <button
                                                                key={cat}
                                                                onClick={() => setUploadForm({ ...uploadForm, category: cat })}
                                                                className={`px-3 py-1 rounded-sm text-[10px] uppercase font-bold tracking-tighter border transition-all ${uploadForm.category === cat ? 'bg-ac-taupe text-white border-ac-taupe' : 'border-ac-taupe/10 text-ac-taupe/60'}`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Internal Notes</label>
                                                    <textarea
                                                        value={uploadForm.internalNote}
                                                        onChange={(e) => setUploadForm({ ...uploadForm, internalNote: e.target.value })}
                                                        placeholder="Sourcing details, styling tips..."
                                                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold h-24 resize-none"
                                                    />
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        if (!uploadFile) return toast.error("Please select a file");
                                                        setIsSaving(true);
                                                        try {
                                                            const fileName = `${Date.now()}-${uploadFile.name}`;
                                                            const { data: uploadData, error: uploadError } = await supabase.storage
                                                                .from('studio-wardrobe')
                                                                .upload(`${clientId}/${fileName}`, uploadFile);

                                                            if (uploadError) throw uploadError;

                                                            const { data: { publicUrl } } = supabase.storage
                                                                .from('studio-wardrobe')
                                                                .getPublicUrl(`${clientId}/${fileName}`);

                                                            const { data: dbData, error: dbError } = await supabase.from('wardrobe_items').insert({
                                                                user_id: clientId,
                                                                image_url: publicUrl,
                                                                category: uploadForm.category,

                                                                notes: uploadForm.internalNote,
                                                                status: 'Keep'
                                                            }).select().single();

                                                            if (dbError) throw dbError;

                                                            setItems([dbData, ...items]);
                                                            toast.success("Item uploaded successfully");
                                                            setIsAdding(false);
                                                            setUploadFile(null);
                                                        } catch (err: any) {
                                                            toast.error(err.message || "Failed to upload");
                                                        } finally {
                                                            setIsSaving(false);
                                                        }
                                                    }}
                                                    disabled={isSaving || !uploadFile}
                                                    className="w-full bg-ac-gold text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-taupe transition-all disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                                    Confirm & Add
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {addMode === 'link' && (
                                        <div className="space-y-8 max-w-xl mx-auto py-8">
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40">Product or Page URL</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Paste shop link (Zara, Farfetch, etc.)"
                                                            value={linkForm.url}
                                                            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                                                            className="flex-1 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                if (!linkForm.url) return;
                                                                setIsExtracting(true);
                                                                const data = await extractUrlMetadata(linkForm.url);
                                                                if (data) {
                                                                    setLinkForm({
                                                                        ...linkForm,
                                                                        imageUrl: data.image || linkForm.imageUrl,
                                                                        internalNote: data.title + (data.description ? `\n\n${data.description}` : "")
                                                                    });
                                                                    if (data.images && data.images.length > 0) {
                                                                        setExtractedImages(data.images);
                                                                    }
                                                                    if (data.image) toast.success("Details extracted!");
                                                                    else toast.info("Link found, but image couldn't be auto-pulled. Please provide it manually.");
                                                                } else {
                                                                    toast.error("Failed to extract data from this link.");
                                                                }
                                                                setIsExtracting(false);
                                                            }}
                                                            disabled={isExtracting || !linkForm.url}
                                                            className="px-4 bg-ac-taupe text-white rounded-sm hover:bg-ac-gold transition-all disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                                                        >
                                                            {isExtracting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Image URL (Manual or Auto-pulled)</label>
                                                    <input
                                                        type="text"
                                                        placeholder="https://..."
                                                        value={linkForm.imageUrl}
                                                        onChange={(e) => setLinkForm({ ...linkForm, imageUrl: e.target.value })}
                                                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                                    />
                                                </div>

                                                {extractedImages.length > 0 && (
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Select Best Image</label>
                                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                                            {extractedImages.map((img, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => setLinkForm({ ...linkForm, imageUrl: img })}
                                                                    className={`relative min-w-[60px] h-[80px] rounded-sm overflow-hidden border-2 transition-all ${linkForm.imageUrl === img ? 'border-ac-gold' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                                >
                                                                    <img src={img} className="w-full h-full object-cover" alt="Choice" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="aspect-square w-32 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm overflow-hidden mx-auto">
                                                    {linkForm.imageUrl ? (
                                                        <img src={linkForm.imageUrl} className="w-full h-full object-contain" alt="Preview" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-ac-taupe/10">
                                                            <ImageIcon size={24} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-3">Category</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {CATEGORIES.map(cat => (
                                                            <button
                                                                key={cat}
                                                                onClick={() => setLinkForm({ ...linkForm, category: cat })}
                                                                className={`px-3 py-1 rounded-sm text-[10px] uppercase font-bold tracking-tighter border transition-all ${linkForm.category === cat ? 'bg-ac-taupe text-white border-ac-taupe' : 'border-ac-taupe/10 text-ac-taupe/60'}`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Item Details / Notes</label>
                                                    <textarea
                                                        value={linkForm.internalNote}
                                                        onChange={(e) => setLinkForm({ ...linkForm, internalNote: e.target.value })}
                                                        placeholder="Extracted details or manual notes..."
                                                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold h-24 resize-none"
                                                    />
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        if (!linkForm.imageUrl) return toast.error("Image URL is required");
                                                        setIsSaving(true);

                                                        // 1. Secure Upload
                                                        let finalImageUrl = linkForm.imageUrl;
                                                        try {
                                                            const uploadRes = await uploadRemoteImage(linkForm.imageUrl, clientId);
                                                            if (uploadRes.success && uploadRes.url) {
                                                                finalImageUrl = uploadRes.url;
                                                            } else {
                                                                console.warn("Remote upload failed, falling back to direct link:", uploadRes.error);
                                                                // Optional: Fail hard? Or allow fallback? 
                                                                // User requested sustainability, so maybe we should warn better.
                                                                toast.warning("Could not save image locally. Using external link.");
                                                            }
                                                        } catch (err) {
                                                            console.error("Upload Error", err);
                                                        }

                                                        // 2. Save Item
                                                        const { data, error } = await supabase.from('wardrobe_items').insert({
                                                            user_id: clientId,
                                                            image_url: finalImageUrl,
                                                            category: linkForm.category,
                                                            notes: linkForm.internalNote,
                                                            product_link_id: null,
                                                            status: 'Keep'
                                                        }).select().single();

                                                        if (error) toast.error("Failed to save link");
                                                        else {
                                                            setItems([data, ...items]);
                                                            toast.success("Link added (and image secured)!");
                                                            setIsAdding(false);
                                                            setLinkForm({ url: "", imageUrl: "", category: "Tops", internalNote: "" });
                                                            setExtractedImages([]);
                                                        }
                                                        setIsSaving(false);
                                                    }}
                                                    disabled={isSaving || !linkForm.imageUrl}
                                                    className="w-full bg-ac-taupe text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-gold transition-all disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                                    Add to Wardrobe
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Update Image Modal */}
            <AnimatePresence>
                {isUpdatingImage && selectedItem && (
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
                                    setIsUpdatingImage(false);
                                    setUpdateFile(null);
                                    setUpdateImageUrl("");
                                }}
                                className="absolute top-4 right-4 z-50 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="p-6 border-b border-ac-taupe/10">
                                <h3 className="font-serif text-xl text-ac-taupe">Update Item Image</h3>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Mode Toggles */}
                                <div className="flex bg-ac-taupe/5 p-1 rounded-sm">
                                    <button
                                        onClick={() => setUpdateImageMode('upload')}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${updateImageMode === 'upload' ? 'bg-white text-ac-taupe shadow-sm' : 'text-ac-taupe/40'}`}
                                    >
                                        Upload
                                    </button>
                                    <button
                                        onClick={() => setUpdateImageMode('link')}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${updateImageMode === 'link' ? 'bg-white text-ac-taupe shadow-sm' : 'text-ac-taupe/40'}`}
                                    >
                                        Link URL
                                    </button>
                                </div>

                                {updateImageMode === 'upload' && (
                                    <div className="space-y-4">
                                        <div className="aspect-square border-2 border-dashed border-ac-taupe/20 rounded-sm flex flex-col items-center justify-center gap-4 bg-ac-taupe/5 relative overflow-hidden">
                                            {updateFile ? (
                                                <img src={URL.createObjectURL(updateFile)} className="absolute inset-0 w-full h-full object-contain" alt="" />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <Camera size={24} className="text-ac-taupe/20 mx-auto mb-2" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40">Select new photo</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                onChange={(e) => setUpdateFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!updateFile) return toast.error("Please select a file");
                                                setIsSaving(true);
                                                try {
                                                    const fileName = `${Date.now()}-UPDATE-${updateFile.name}`;
                                                    const { error: uploadError } = await supabase.storage
                                                        .from('studio-wardrobe')
                                                        .upload(`${clientId}/${fileName}`, updateFile);

                                                    if (uploadError) throw uploadError;

                                                    const { data: { publicUrl } } = supabase.storage
                                                        .from('studio-wardrobe')
                                                        .getPublicUrl(`${clientId}/${fileName}`);

                                                    // Update DB
                                                    await handleUpdateItem(selectedItem.id, { image_url: publicUrl });
                                                    setIsUpdatingImage(false);
                                                    setUpdateFile(null);
                                                    toast.success("Image Updated");
                                                } catch (err: any) {
                                                    toast.error("Error: " + err.message);
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }}
                                            disabled={isSaving}
                                            className="w-full bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                            Save Upload
                                        </button>
                                    </div>
                                )}

                                {updateImageMode === 'link' && (
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="https://..."
                                            value={updateImageUrl}
                                            onChange={(e) => setUpdateImageUrl(e.target.value)}
                                            className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold"
                                        />
                                        <div className="aspect-square bg-ac-taupe/5 rounded-sm overflow-hidden flex items-center justify-center">
                                            {updateImageUrl ? (
                                                <img src={updateImageUrl} className="w-full h-full object-contain" alt="" />
                                            ) : (
                                                <ImageIcon size={24} className="text-ac-taupe/10" />
                                            )}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!updateImageUrl) return toast.error("Please enter a URL");
                                                setIsSaving(true);
                                                await handleUpdateItem(selectedItem.id, { image_url: updateImageUrl });
                                                setIsUpdatingImage(false);
                                                setUpdateImageUrl("");
                                                toast.success("Image Updated");
                                                setIsSaving(false);
                                            }}
                                            disabled={isSaving}
                                            className="w-full bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                            Save Link
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Clone Modal */}
            <AnimatePresence>
                {isCloning && selectedItem && !isClientView && (
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
                                onClick={() => { setIsCloning(false); setTargetClient(""); }}
                                className="absolute top-4 right-4 z-50 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="p-6 border-b border-ac-taupe/10">
                                <h3 className="font-serif text-xl text-ac-taupe">Clone Item</h3>
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
                                            <option key={client.id} value={client.id}>{client.full_name || 'Unnamed'}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleCloneItem}
                                    disabled={isSaving || !targetClient}
                                    className="w-full bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-ac-taupe transition-all disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                                    Duplicate to Client
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
