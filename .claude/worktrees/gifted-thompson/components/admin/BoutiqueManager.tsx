
"use client";

import { useState, useEffect } from "react";
import { getActiveBrands, getBoutiqueItems } from "@/app/actions/boutique";
import { deleteBrand, deleteBoutiqueItem } from "@/app/actions/admin/manage-boutique"; // Need to make delete public or fetch all
import BrandForm from "./BrandForm";
import ItemForm from "./ItemForm";
import { Plus, Tag, Trash2, Edit2 } from "lucide-react";

import BoutiqueItemUploader from "./BoutiqueItemUploader";

export default function BoutiqueManager() {
    const [view, setView] = useState<'brands' | 'items' | 'bulk_upload'>('items');
    const [brands, setBrands] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const loadData = async () => {
        const [bRes, iRes] = await Promise.all([getActiveBrands(), getBoutiqueItems()]);
        if (bRes.success) setBrands(bRes.brands || []);
        if (iRes.success) setItems(iRes.items || []);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSuccess = () => {
        loadData();
        setEditingItem(null);
        setIsCreating(false);
        // If coming from bulk upload, likely stay there or go to items? 
        // Let's go to items to show the new stuff
        if (view === 'bulk_upload') setView('items');
    };

    const handleDelete = async (id: string, type: 'brand' | 'item') => {
        if (!confirm("Are you sure? This cannot be undone.")) return;

        const action = type === 'brand' ? deleteBrand(id) : deleteBoutiqueItem(id);
        await action; // Simplified error handling
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-ac-taupe/10 pb-4 justify-between items-center">
                <div className="flex gap-4">
                    <button
                        onClick={() => setView('items')}
                        className={`text-sm uppercase tracking-widest font-bold ${view === 'items' ? 'text-ac-gold' : 'text-ac-taupe/40'}`}
                    >
                        Products
                    </button>
                    <button
                        onClick={() => setView('brands')}
                        className={`text-sm uppercase tracking-widest font-bold ${view === 'brands' ? 'text-ac-gold' : 'text-ac-taupe/40'}`}
                    >
                        Partner Brands
                    </button>
                </div>

                {/* Bulk Upload Toggle */}
                <button
                    onClick={() => { setView('bulk_upload'); setIsCreating(false); setEditingItem(null); }}
                    className={`flex items-center gap-2 text-sm uppercase tracking-widest font-bold ${view === 'bulk_upload' ? 'text-ac-gold' : 'text-ac-taupe/40 hover:text-ac-taupe'}`}
                >
                    <Plus size={16} />
                    Bulk Upload
                </button>
            </div>

            {view !== 'bulk_upload' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => { setIsCreating(true); setEditingItem(null); }}
                        className="flex items-center gap-2 bg-ac-taupe text-white px-4 py-2 rounded-sm text-sm"
                    >
                        <Plus size={16} />
                        {view === 'brands' ? 'Add Brand' : 'Add Single Item'}
                    </button>
                </div>
            )}

            {/* Bulk Uploader View */}
            {view === 'bulk_upload' && (
                <div className="bg-white/40 border border-white/30 rounded-sm p-6">
                    <BoutiqueItemUploader
                        brands={brands}
                        onSuccess={handleSuccess}
                        onCancel={() => setView('items')}
                    />
                </div>
            )}

            {/* Form */}
            {(isCreating || editingItem) && view !== 'bulk_upload' && (
                <div className="bg-white/60 p-6 rounded-sm border border-ac-gold/30">
                    <h3 className="font-serif text-xl text-ac-taupe mb-4">{editingItem ? 'Edit' : 'Create New'}</h3>
                    {view === 'brands' ? (
                        <BrandForm brand={editingItem} onSuccess={handleSuccess} onCancel={() => { setIsCreating(false); setEditingItem(null); }} />
                    ) : (
                        <ItemForm item={editingItem} brands={brands} onSuccess={handleSuccess} onCancel={() => { setIsCreating(false); setEditingItem(null); }} />
                    )}
                </div>
            )}

            {/* List */}
            {view !== 'bulk_upload' && (
                <div className="bg-white/40 border border-white/30 rounded-sm overflow-hidden">
                    {loading ? <div className="p-8 text-center text-ac-taupe/40">Loading...</div> : (
                        <table className="w-full text-left text-sm text-ac-taupe">
                            <thead className="bg-ac-taupe/5 uppercase tracking-widest text-xs font-bold text-ac-taupe/60">
                                <tr>
                                    <th className="p-4">Name</th>
                                    {view === 'items' && <th className="p-4">Brand</th>}
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ac-taupe/5">
                                {(view === 'brands' ? brands : items).map((obj) => (
                                    <tr key={obj.id} className="hover:bg-white/40">
                                        <td className="p-4 flex items-center gap-3">
                                            {(obj.logo_url || obj.image_url) && (
                                                <img src={obj.logo_url || obj.image_url} className="w-8 h-8 object-cover rounded-sm bg-white" />
                                            )}
                                            {obj.name}
                                        </td>
                                        {view === 'items' && (
                                            <td className="p-4 opacity-60">{obj.brand?.name}</td>
                                        )}
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setEditingItem(obj)} className="p-2 hover:bg-black/5 rounded-full"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(obj.id, view === 'brands' ? 'brand' : 'item')} className="p-2 hover:bg-red-500/10 text-red-500 rounded-full"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {(view === 'brands' ? brands : items).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-ac-taupe/40">Nothing found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
