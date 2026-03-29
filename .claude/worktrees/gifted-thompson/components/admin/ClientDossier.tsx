
"use client";

import { useState, useEffect } from "react";
import { getClientDossier } from "@/app/actions/admin/manage-clients";
import { X, Sparkles } from "lucide-react";
import VirtualWardrobe from "@/components/studio/VirtualWardrobe";


interface ClientDossierProps {
    client: any;
    onClose: () => void;
}

export default function ClientDossier({ client, onClose }: ClientDossierProps) {
    const [dossier, setDossier] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (client?.id) {
            getClientDossier(client.id).then(res => {
                if (res.success) setDossier(res.dossier || []);
                setLoading(false);
            });
        }
    }, [client]);

    // Group by Masterclass
    const grouped = dossier.reduce((acc, item) => {
        const mcTitle = item.masterclass?.title || 'Standalone / Other';
        if (!acc[mcTitle]) acc[mcTitle] = [];
        acc[mcTitle].push(item);
        return acc;
    }, {} as Record<string, any[]>);

    const [activeTab, setActiveTab] = useState<'essence' | 'wardrobe'>('essence');

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-ac-taupe/20 backdrop-blur-sm" onClick={onClose} />

            {/* Slide-over Panel */}
            <div className="relative w-full max-w-2xl bg-[#FDFBF7] shadow-2xl h-full overflow-y-auto border-l border-ac-taupe/10">
                <div className="sticky top-0 bg-[#FDFBF7]/95 backdrop-blur-md p-8 border-b border-ac-taupe/10 flex justify-between items-start z-10">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-ac-gold mb-2 block">
                            Confidential Dossier
                        </span>
                        <h2 className="font-serif text-4xl text-ac-taupe mb-1">
                            {client.full_name || 'Client File'}
                        </h2>
                        <p className="text-ac-taupe/40 text-sm">
                            ID: {client.id}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <X size={24} className="text-ac-taupe" />
                    </button>
                </div>

                <div className="p-8 space-y-12">
                    <div className="flex gap-4 border-b border-ac-taupe/10 mb-6">
                        <button
                            onClick={() => setActiveTab('essence')}
                            className={`pb-2 font-serif transition-colors ${activeTab === 'essence' ? 'border-b-2 border-ac-gold text-ac-taupe' : 'text-ac-taupe/40'}`}
                        >
                            Essence
                        </button>
                        <div className="text-ac-taupe/20 px-2">|</div>
                        <button
                            onClick={() => setActiveTab('wardrobe')}
                            className={`pb-2 font-serif transition-colors ${activeTab === 'wardrobe' ? 'border-b-2 border-ac-gold text-ac-taupe' : 'text-ac-taupe/40'}`}
                        >
                            Wardrobe
                        </button>
                    </div>

                    {activeTab === 'essence' && (
                        loading ? (
                            <div className="text-center py-20 text-ac-taupe/40">Loading dossier...</div>
                        ) : dossier.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-ac-taupe/10 rounded-sm">
                                <Sparkles className="mx-auto text-ac-taupe/20 mb-4" size={48} />
                                <p className="text-ac-taupe/60">No essence data recorded yet.</p>
                            </div>
                        ) : (
                            (Object.entries(grouped) as [string, any[]][]).map(([mcTitle, items]) => (
                                <div key={mcTitle} className="space-y-6">
                                    <h3 className="font-serif text-2xl text-ac-taupe border-b border-ac-taupe/10 pb-2">
                                        {mcTitle}
                                    </h3>

                                    <div className="grid gap-6">
                                        {items.map((item: any, i: number) => (
                                            <div key={i} className="bg-white p-6 rounded-sm shadow-sm border border-ac-taupe/5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-xs uppercase tracking-widest text-ac-taupe/40 bg-ac-taupe/5 px-2 py-1 rounded-sm">
                                                        {item.question_key.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-ac-taupe/30">
                                                        {new Date(item.updated_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="font-serif text-lg text-ac-taupe leading-relaxed">
                                                    {typeof item.answer_value === 'string'
                                                        ? item.answer_value
                                                        : JSON.stringify(item.answer_value)}
                                                </div>
                                                {item.chapter_slug && (
                                                    <p className="text-xs text-ac-taupe/30 mt-3 text-right">
                                                        Context: {item.chapter_slug}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === 'wardrobe' && (
                        /* Dynamic import to avoid circular dep issues if any, though VirtualWardrobe is client component */
                        <VirtualWardrobeWrapper clientId={client.id} />
                    )}

                </div>
            </div>
        </div>
    );
}

function VirtualWardrobeWrapper({ clientId }: { clientId: string }) {
    return (
        <div className="bg-ac-taupe/5 p-4 rounded-sm -mx-4">
            <VirtualWardrobe clientId={clientId} />
        </div>
    );
}
