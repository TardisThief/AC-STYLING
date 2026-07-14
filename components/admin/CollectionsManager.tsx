"use client";

import { useState, useEffect } from "react";
import type { BoutiqueItem, BoutiqueCollection } from "@/app/lib/types";
import { Plus, Trash2, Edit2, Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "./ImageUpload";
import {
    getCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    setCollectionItems,
} from "@/app/actions/admin/manage-boutique";

interface CollectionsManagerProps {
    items: BoutiqueItem[];
}

const EMPTY_FORM = {
    title: "",
    title_es: "",
    description: "",
    description_es: "",
    cover_image_url: "",
    active: true,
};

export default function CollectionsManager({ items }: CollectionsManagerProps) {
    const [collections, setCollections] = useState<BoutiqueCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = async () => {
        const res = await getCollections();
        if (res.success) setCollections(res.collections || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const startEdit = (col: BoutiqueCollection) => {
        setEditingId(col.id);
        setIsCreating(false);
        setFormData({
            title: col.title || "",
            title_es: col.title_es || "",
            description: col.description || "",
            description_es: col.description_es || "",
            cover_image_url: col.cover_image_url || "",
            active: col.active ?? true,
        });
        setSelectedItems((col.items || []).map((i) => i.item_id));
    };

    const startCreate = () => {
        setEditingId(null);
        setIsCreating(true);
        setFormData({ ...EMPTY_FORM });
        setSelectedItems([]);
    };

    const cancel = () => {
        setEditingId(null);
        setIsCreating(false);
    };

    const set = (key: string, val: unknown) => setFormData(prev => ({ ...prev, [key]: val }));

    const toggleItem = (itemId: string) => {
        setSelectedItems(prev =>
            prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error("Collection title is required.");
            return;
        }
        setSaving(true);
        try {
            let collectionId: string;
            if (isCreating) {
                const res = await createCollection({ ...formData, order_index: collections.length });
                if (!res.success) { toast.error(res.error); return; }
                collectionId = res.id;
                toast.success("Collection created");
            } else {
                const res = await updateCollection(editingId!, formData);
                if (!res.success) { toast.error(res.error); return; }
                collectionId = editingId!;
                toast.success("Collection updated");
            }
            await setCollectionItems(collectionId, selectedItems);
            load();
            cancel();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete collection "${title}"? Items will not be deleted.`)) return;
        const res = await deleteCollection(id);
        if (res.success) {
            toast.success("Collection deleted");
            load();
        } else {
            toast.error(res.error);
        }
    };

    const isFormOpen = isCreating || !!editingId;

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={startCreate}
                    className="flex items-center gap-2 bg-ac-taupe text-white px-4 py-2 rounded-sm text-sm hover:bg-ac-taupe/90"
                >
                    <Plus size={16} /> New Collection
                </button>
            </div>

            {/* Form */}
            {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-white/60 border border-ac-gold/30 rounded-sm p-6 space-y-4">
                    <h3 className="font-serif text-lg text-ac-taupe">
                        {isCreating ? "New Collection" : "Edit Collection"}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Title (EN) *</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => set('title', e.target.value)}
                                className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Title (ES)</label>
                            <input
                                type="text"
                                value={formData.title_es}
                                onChange={e => set('title_es', e.target.value)}
                                className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Description (EN)</label>
                            <textarea
                                rows={2}
                                value={formData.description}
                                onChange={e => set('description', e.target.value)}
                                className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Description (ES)</label>
                            <textarea
                                rows={2}
                                value={formData.description_es}
                                onChange={e => set('description_es', e.target.value)}
                                className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold resize-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Cover Image</label>
                        <ImageUpload
                            value={formData.cover_image_url}
                            onChange={url => set('cover_image_url', url)}
                            placeholder="Upload Cover Image"
                            bucket="boutique"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="col-active"
                            checked={formData.active}
                            onChange={e => set('active', e.target.checked)}
                            className="accent-ac-gold"
                        />
                        <label htmlFor="col-active" className="text-xs font-bold uppercase tracking-widest text-ac-taupe/60">Active (visible in boutique)</label>
                    </div>

                    {/* Item Assignment */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-2">
                            Assign Items ({selectedItems.length} selected)
                        </label>
                        <div className="max-h-48 overflow-y-auto border border-ac-taupe/10 rounded-sm divide-y divide-ac-taupe/5">
                            {items.length === 0 ? (
                                <p className="p-4 text-sm text-ac-taupe/40 text-center">No items available. Add products first.</p>
                            ) : (
                                items.map(item => (
                                    <label
                                        key={item.id}
                                        className="flex items-center gap-3 p-3 hover:bg-white/60 cursor-pointer"
                                    >
                                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${selectedItems.includes(item.id) ? 'bg-ac-gold border-ac-gold' : 'border-ac-taupe/30'}`}>
                                            {selectedItems.includes(item.id) && <Check size={10} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => toggleItem(item.id)}
                                        />
                                        {item.image_url && (
                                            <img src={item.image_url} className="w-8 h-8 object-cover rounded-sm bg-white border border-ac-taupe/10" />
                                        )}
                                        <span className="text-sm text-ac-taupe">{item.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={cancel} className="px-4 py-2 text-sm text-ac-taupe/60 hover:text-ac-taupe">Cancel</button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-ac-taupe text-white px-6 py-2 rounded-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {isCreating ? "Create Collection" : "Save Changes"}
                        </button>
                    </div>
                </form>
            )}

            {/* Collections List */}
            <div className="bg-white/40 border border-white/30 rounded-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-ac-taupe/40">Loading...</div>
                ) : collections.length === 0 ? (
                    <div className="p-8 text-center text-ac-taupe/40">
                        <p>No collections yet.</p>
                        <p className="text-xs mt-1">Create a collection to group boutique items for the storefront.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-ac-taupe">
                        <thead className="bg-ac-taupe/5 uppercase tracking-widest text-xs font-bold text-ac-taupe/60">
                            <tr>
                                <th className="p-4">Cover</th>
                                <th className="p-4">Title</th>
                                <th className="p-4 text-center">Items</th>
                                <th className="p-4 text-center">Active</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ac-taupe/5">
                            {collections.map(col => (
                                <tr key={col.id} className={`hover:bg-white/40 ${!col.active ? 'opacity-40' : ''}`}>
                                    <td className="p-4">
                                        {col.cover_image_url ? (
                                            <img src={col.cover_image_url} className="w-12 h-8 object-cover rounded-sm bg-white border border-ac-taupe/10" />
                                        ) : (
                                            <div className="w-12 h-8 rounded-sm bg-ac-taupe/5 border border-ac-taupe/10" />
                                        )}
                                    </td>
                                    <td className="p-4 font-medium">
                                        {col.title}
                                        {col.title_es && <span className="text-xs text-ac-taupe/40 ml-2">/ {col.title_es}</span>}
                                    </td>
                                    <td className="p-4 text-center text-ac-taupe/60">
                                        {(col.items || []).length}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`text-xs font-bold uppercase ${col.active ? 'text-ac-olive' : 'text-ac-taupe/30'}`}>
                                            {col.active ? 'Yes' : 'No'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => startEdit(col)} className="p-2 hover:bg-black/5 rounded-full">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(col.id, col.title)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-full">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
