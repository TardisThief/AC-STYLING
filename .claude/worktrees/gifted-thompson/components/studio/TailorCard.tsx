"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Ruler, Sparkles, Check, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface TailorCardProps {
    clientId: string;
}

const MEASUREMENT_FIELDS = [
    { key: 'bust', label: 'Bust', unit: 'cm/in' },
    { key: 'waist', label: 'Waist', unit: 'cm/in' },
    { key: 'hips', label: 'Hips', unit: 'cm/in' },
    { key: 'inseam', label: 'Inseam', unit: 'cm/in' },
    { key: 'shoulders', label: 'Shoulders', unit: 'cm/in' },
    { key: 'height', label: 'Height', unit: 'cm/in' },
    { key: 'shoe_size', label: 'Shoe Size', unit: 'US/EU' },
];

export default function TailorCard({ clientId }: TailorCardProps) {
    const [measurements, setMeasurements] = useState<Record<string, string>>({});
    const [dna, setDna] = useState<any[]>([]);
    const [isActiveClient, setIsActiveClient] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        async function loadData() {
            setLoading(true);

            // First, get the wardrobe to find the owner_id (clientId is now a wardrobe ID)
            const { data: wardrobe, error: wardrobeError } = await supabase
                .from('wardrobes')
                .select('owner_id')
                .eq('id', clientId)
                .single();

            if (wardrobeError || !wardrobe) {
                setLoading(false);
                return;
            }

            const ownerId = wardrobe.owner_id;

            // If no owner, show empty state
            if (!ownerId) {
                setMeasurements({});
                setDna([]);
                setIsActiveClient(false);
                setLoading(false);
                return;
            }

            // Fetch profile-based data using owner_id
            const [tailorRes, dnaRes, profileRes] = await Promise.all([
                supabase.from('tailor_cards').select('measurements').eq('user_id', ownerId).single(),
                supabase.from('essence_responses').select('*').eq('user_id', ownerId),
                supabase.from('profiles').select('active_studio_client').eq('id', ownerId).single()
            ]);

            if (tailorRes.data) {
                setMeasurements(tailorRes.data.measurements || {});
            } else {
                setMeasurements({});
            }

            setDna(dnaRes.data || []);
            setIsActiveClient(profileRes.data?.active_studio_client || false);
            setOwnerId(ownerId);
            setLoading(false);
        }

        loadData();
    }, [clientId, supabase]);

    const handleUpdate = async (key: string, value: string) => {
        if (!ownerId) return; // Can't save without an owner
        const newMeasurements = { ...measurements, [key]: value };
        setMeasurements(newMeasurements);
        setSaving(true);
        const { error } = await supabase
            .from('tailor_cards')
            .upsert({
                user_id: ownerId,
                measurements: newMeasurements,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) toast.error("Failed to save measurement");
        setSaving(false);
    };

    const toggleActiveStatus = async () => {
        if (!ownerId) return; // Can't toggle without an owner
        const newValue = !isActiveClient;
        setIsActiveClient(newValue);
        const { error } = await supabase
            .from('profiles')
            .update({ active_studio_client: newValue })
            .eq('id', ownerId);

        if (error) {
            toast.error("Failed to update status");
            setIsActiveClient(!newValue); // Revert
        } else {
            toast.success(newValue ? "Client Wardrobe Unlocked" : "Client Wardrobe Locked");
        }
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-ac-gold" /></div>;

    // Filter DNA 
    const coreDna = dna.filter(entry =>
        ['style_words', 'style_mood', 'best_feature'].includes(entry.question_key)
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Measurements Section */}
            <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Ruler className="text-ac-gold" size={24} />
                        <div>
                            <h3 className="font-serif text-2xl text-ac-taupe">Technical Profile</h3>
                            {saving && <span className="text-[9px] uppercase font-bold text-ac-taupe/40">Saving...</span>}
                        </div>
                    </div>

                    {/* Status Toggle */}
                    <div className="flex items-center gap-2 bg-ac-taupe/5 p-2 rounded-full px-4">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isActiveClient ? 'text-ac-olive' : 'text-ac-taupe/40'}`}>
                            {isActiveClient ? 'Active Client' : 'Inactive'}
                        </span>
                        <button
                            onClick={toggleActiveStatus}
                            className={`w-8 h-4 rounded-full relative transition-colors ${isActiveClient ? 'bg-ac-olive' : 'bg-ac-taupe/20'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isActiveClient ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    {MEASUREMENT_FIELDS.map((field) => (
                        <div key={field.key} className="relative">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">
                                {field.label} ({field.unit})
                            </label>
                            <input
                                type="text"
                                value={measurements[field.key] || ""}
                                onChange={(e) => handleUpdate(field.key, e.target.value)}
                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm px-4 py-3 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold transition-all font-serif"
                                placeholder="..."
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* DNA Integration Section */}
            <div className="space-y-6">
                <div className="bg-ac-taupe text-white p-8 rounded-sm shadow-xl relative overflow-hidden">
                    <Sparkles className="absolute -top-4 -right-4 text-white/5" size={120} />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <Sparkles className="text-ac-gold" size={24} />
                            <h3 className="font-serif text-2xl">Style Essence DNA</h3>
                        </div>

                        <div className="space-y-8">
                            {coreDna.length > 0 ? coreDna.map((entry) => (
                                <div key={entry.id} className="border-l-2 border-ac-gold/30 pl-4 py-1">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                                        {entry.question_key.replace(/_/g, ' ')}
                                    </h4>
                                    <p className="font-serif text-lg italic leading-relaxed">
                                        "{entry.response_value || entry.answer_value}"
                                    </p>
                                </div>
                            )) : (
                                <p className="text-white/40 text-sm italic">
                                    No essence lab responses found for this client yet.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white/40 border border-white/50 p-6 rounded-sm flex gap-4">
                    <Info className="text-ac-taupe/40 shrink-0" size={20} />
                    <p className="text-xs text-ac-taupe/60 italic leading-relaxed">
                        Toggle "Active Client" to unlock their Wardrobe features in the Vault.
                    </p>
                </div>
            </div>
        </div>
    );
}
