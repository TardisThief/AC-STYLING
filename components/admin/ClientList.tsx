
"use client";

import { useState, useEffect } from "react";
import { getClients, toggleStudioAccess } from "@/app/actions/admin/manage-clients";
import { User, Search, Eye, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";

interface ClientListProps {
    onSelectClient: (client: any) => void;
}

export default function ClientList({ onSelectClient }: ClientListProps) {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showStudioOnly, setShowStudioOnly] = useState(true);

    useEffect(() => {
        getClients().then(res => {
            if (res.success) setClients(res.clients || []);
            setLoading(false);
        });
    }, []);

    const filteredClients = clients.filter(c => {
        // Filter by Studio Status
        if (showStudioOnly && !c.active_studio_client) return false;

        // Filter by Search
        if (!search) return true;
        const nameMatch = (c.full_name || '').toLowerCase().includes(search.toLowerCase());
        const usernameMatch = (c.username || '').toLowerCase().includes(search.toLowerCase());
        return nameMatch || usernameMatch;
    });

    if (loading) return <div className="p-8 text-center text-ac-taupe/40">Loading clients...</div>;

    return (
        <div className="space-y-6">
            {/* Search */}
            {/* Search & Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-ac-taupe/40" size={18} />
                    <input
                        type="text"
                        placeholder="Search clients..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/40 border border-ac-taupe/10 rounded-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                    />
                </div>
                <button
                    onClick={() => setShowStudioOnly(!showStudioOnly)}
                    className={`px-4 py-3 rounded-sm font-bold uppercase tracking-widest text-xs transition-all border flex items-center gap-2 ${showStudioOnly
                        ? 'bg-ac-gold text-white border-ac-gold'
                        : 'bg-white/40 text-ac-taupe/60 border-ac-taupe/10 hover:border-ac-taupe/30'
                        }`}
                >
                    <Sparkles size={16} />
                    {showStudioOnly ? 'Studio Clients' : 'All Users'}
                </button>
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredClients.map(client => (
                    <div key={client.id} className="bg-white/60 p-4 rounded-sm border border-white/50 flex items-center justify-between group hover:border-ac-gold/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-ac-taupe/10 rounded-full flex items-center justify-center text-ac-taupe">
                                {client.avatar_url ? (
                                    <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <User size={20} />
                                )}
                            </div>
                            <div>
                                <h4 className="font-serif text-lg text-ac-taupe leading-tight">
                                    {client.full_name || client.email || 'Unnamed Client'}
                                </h4>
                                <p className="text-xs text-ac-taupe/40 uppercase tracking-widest">
                                    {client.email || `User ID: ${client.id.slice(0, 8)}...`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Studio Access Toggle */}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const hasAccess = client.active_studio_client === true;
                                    const newAccess = !hasAccess;

                                    // Optimistic update
                                    setClients(prev => prev.map(c =>
                                        c.id === client.id
                                            ? {
                                                ...c,
                                                active_studio_client: newAccess,
                                                studio_permissions: newAccess
                                                    ? { lookbook: true, wardrobe: true }
                                                    : { lookbook: false, wardrobe: false }
                                            }
                                            : c
                                    ));

                                    const result = await toggleStudioAccess(client.id, newAccess);
                                    if (result.success) {
                                        toast.success(newAccess ? 'Access Granted' : 'Access Revoked');
                                    } else {
                                        toast.error('Failed to update access');
                                        // Revert
                                        setClients(prev => prev.map(c =>
                                            c.id === client.id
                                                ? {
                                                    ...c,
                                                    active_studio_client: hasAccess,
                                                    studio_permissions: hasAccess
                                                        ? { lookbook: true, wardrobe: true }
                                                        : { lookbook: false, wardrobe: false }
                                                }
                                                : c
                                        ));
                                    }
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${client.active_studio_client
                                    ? 'bg-ac-gold/10 border-ac-gold/30 text-ac-taupe'
                                    : 'bg-white/50 border-ac-taupe/10 text-ac-taupe/40 grayscale'
                                    }`}
                                title={client.active_studio_client ? "Studio Active" : "Studio Locked"}
                            >
                                {client.active_studio_client ? <Sparkles size={14} /> : <Lock size={14} />}
                                <span className="text-[10px] uppercase font-bold tracking-widest">
                                    {client.active_studio_client ? 'Studio On' : 'Studio Off'}
                                </span>
                            </button>

                            <button
                                onClick={() => onSelectClient(client)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-ac-taupe/10 rounded-full text-xs font-bold uppercase tracking-widest text-ac-taupe hover:bg-ac-taupe hover:text-white transition-colors"
                            >
                                <Eye size={14} />
                                View Dossier
                            </button>

                            {/* Copy Wardrobe Link for Active Clients */}
                            {client.active_studio_client && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const link = `${window.location.origin}/vault/profile`;
                                        navigator.clipboard.writeText(link);
                                        toast.success("Wardrobe Link Copied to Clipboard");
                                    }}
                                    className="p-2 border border-ac-taupe/10 rounded-full text-ac-taupe/40 hover:text-ac-gold hover:border-ac-gold transition-colors"
                                    title="Copy Personal Wardrobe Link"
                                >
                                    <Sparkles size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {filteredClients.length === 0 && (
                    <p className="text-center text-ac-taupe/40 py-8">No clients found.</p>
                )}
            </div>
        </div>
    );
}
