"use client";

import { useState, useEffect } from "react";
import type { TrustedLogo } from "@/app/lib/types";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "./ImageUpload";
import {
    getTrustedByLogos,
    createTrustedByLogo,
    updateTrustedByLogo,
    deleteTrustedByLogo,
} from "@/app/actions/admin/manage-boutique";

export default function TrustedByManager() {
    const [logos, setLogos] = useState<TrustedLogo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newLogo, setNewLogo] = useState({ name: "", logo_url: "" });

    const load = async () => {
        const res = await getTrustedByLogos();
        if (res.success) setLogos(res.logos || []);
        setLoading(false);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount data fetch
    useEffect(() => { load(); }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLogo.name || !newLogo.logo_url) {
            toast.error("Name and logo image are required.");
            return;
        }
        setSaving(true);
        const res = await createTrustedByLogo({ ...newLogo, order_index: logos.length });
        if (res.success) {
            toast.success("Logo added");
            setNewLogo({ name: "", logo_url: "" });
            setIsAdding(false);
            load();
        } else {
            toast.error(res.error);
        }
        setSaving(false);
    };

    const handleToggleActive = async (logo: TrustedLogo) => {
        const res = await updateTrustedByLogo(logo.id, { active: !logo.active });
        if (res.success) {
            setLogos(prev => prev.map(l => l.id === logo.id ? { ...l, active: !l.active } : l));
        } else {
            toast.error(res.error);
        }
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const newLogos = [...logos];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= newLogos.length) return;
        [newLogos[index], newLogos[swapIndex]] = [newLogos[swapIndex], newLogos[index]];
        setLogos(newLogos);
        // Persist new order_index values
        await Promise.all(newLogos.map((l, i) => updateTrustedByLogo(l.id, { order_index: i })));
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remove this logo from the landing page?")) return;
        const res = await deleteTrustedByLogo(id);
        if (res.success) {
            toast.success("Logo removed");
            load();
        } else {
            toast.error(res.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-xs text-ac-taupe/50 uppercase tracking-widest font-bold">
                    {logos.filter(l => l.active).length} active · {logos.length} total
                </p>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-ac-taupe text-white px-4 py-2 rounded-sm text-sm hover:bg-ac-taupe/90"
                >
                    <Plus size={16} /> Add Logo
                </button>
            </div>

            {/* Add Form */}
            {isAdding && (
                <form onSubmit={handleAdd} className="bg-white/60 border border-ac-gold/30 rounded-sm p-6 space-y-4">
                    <h3 className="font-serif text-lg text-ac-taupe">New Trusted By Logo</h3>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Brand / Client Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Zara"
                            value={newLogo.name}
                            onChange={(e) => setNewLogo(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-white/60 border border-ac-taupe/20 rounded-sm p-3 focus:outline-none focus:border-ac-gold"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-ac-taupe/60 mb-1">Logo Image *</label>
                        <ImageUpload
                            value={newLogo.logo_url}
                            onChange={(url) => setNewLogo(prev => ({ ...prev, logo_url: url }))}
                            placeholder="Upload Logo (PNG with transparency recommended)"
                            bucket="boutique"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => { setIsAdding(false); setNewLogo({ name: "", logo_url: "" }); }} className="px-4 py-2 text-sm text-ac-taupe/60 hover:text-ac-taupe">Cancel</button>
                        <button type="submit" disabled={saving} className="bg-ac-taupe text-white px-6 py-2 rounded-sm flex items-center gap-2 disabled:opacity-50">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Add to Landing Page
                        </button>
                    </div>
                </form>
            )}

            {/* Logo List */}
            <div className="bg-white/40 border border-white/30 rounded-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-ac-taupe/40">Loading...</div>
                ) : logos.length === 0 ? (
                    <div className="p-8 text-center text-ac-taupe/40">
                        <p>No logos added yet.</p>
                        <p className="text-xs mt-1">Upload the 12 partner logos to replace the static ones on the landing page.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-ac-taupe">
                        <thead className="bg-ac-taupe/5 uppercase tracking-widest text-xs font-bold text-ac-taupe/60">
                            <tr>
                                <th className="p-4">Order</th>
                                <th className="p-4">Logo</th>
                                <th className="p-4">Name</th>
                                <th className="p-4 text-center">Active</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ac-taupe/5">
                            {logos.map((logo, index) => (
                                <tr key={logo.id} className={`hover:bg-white/40 ${!logo.active ? 'opacity-40' : ''}`}>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-0.5 hover:text-ac-gold disabled:opacity-20">
                                                <ChevronUp size={14} />
                                            </button>
                                            <button onClick={() => handleMove(index, 'down')} disabled={index === logos.length - 1} className="p-0.5 hover:text-ac-gold disabled:opacity-20">
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="w-16 h-8 bg-white rounded-sm flex items-center justify-center overflow-hidden border border-ac-taupe/10">
                                            <img src={logo.logo_url} alt={logo.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium">{logo.name}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(logo)}
                                            title={logo.active ? "Visible on landing page" : "Hidden"}
                                            className={`p-1 rounded-full transition-colors ${logo.active ? 'text-ac-olive hover:text-ac-taupe' : 'text-ac-taupe/30 hover:text-ac-olive'}`}
                                        >
                                            {logo.active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDelete(logo.id)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-full">
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
