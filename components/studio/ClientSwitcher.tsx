"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, User, Zap, Plus } from "lucide-react";

interface ClientSwitcherProps {
    onSelect: (client: any) => void;
    onAddClient: () => void;
    selectedId?: string;
}

export default function ClientSwitcher({ onSelect, onAddClient, selectedId }: ClientSwitcherProps) {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const supabase = createClient();

    useEffect(() => {
        async function fetchClients() {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('status', 'active')
                .or('active_studio_client.eq.true,is_guest.eq.true')
                .order('updated_at', { ascending: false });

            if (error) {
                console.error("Error fetching clients:", error);
            } else {
                setClients(data || []);
            }
            setLoading(true);
            setLoading(false);
        }

        fetchClients();
    }, [supabase]);

    const filteredClients = clients.filter(c => {
        if (!search) return true;
        const nameMatch = c.full_name?.toLowerCase().includes(search.toLowerCase());
        const emailMatch = c.email?.toLowerCase().includes(search.toLowerCase());
        return nameMatch || emailMatch;
    });

    if (loading) return <div className="p-4 text-center text-ac-taupe/40 text-xs">Loading clients...</div>;

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
                    onClick={onAddClient}
                    className="p-2 bg-ac-taupe text-white rounded-sm hover:bg-ac-gold transition-colors"
                    title="Add Management Client"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredClients.map((client) => (
                    <button
                        key={client.id}
                        onClick={() => onSelect(client)}
                        className={`
                            w-full flex items-center gap-3 p-3 rounded-sm transition-all text-left
                            ${selectedId === client.id
                                ? 'bg-ac-taupe text-white shadow-md'
                                : 'hover:bg-white/50 text-ac-taupe/70'}
                        `}
                    >
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center shrink-0
                            ${selectedId === client.id ? 'bg-white/20' : 'bg-ac-taupe/5'}
                        `}>
                            {client.avatar_url ? (
                                <img src={client.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <User size={14} />
                            )}
                        </div>
                        <div className="overflow-hidden">
                            <h4 className="text-sm font-serif truncate">
                                {client.full_name || 'Guest Icon'}
                            </h4>
                            <div className="flex items-center gap-1">
                                {client.is_guest && <Zap size={10} className="text-ac-gold" />}
                                <p className={`text-[9px] uppercase tracking-widest font-bold opacity-40 truncate`}>
                                    {client.is_guest ? 'Guest' : 'Member'}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}

                {filteredClients.length === 0 && (
                    <p className="text-center py-8 text-[10px] text-ac-taupe/40 uppercase tracking-widest">
                        No clients found
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
