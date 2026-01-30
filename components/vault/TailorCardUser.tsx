'use client';

import { useState } from 'react';
import { Ruler, Loader2, Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';

interface TailorCardUserProps {
    initialMeasurements: Record<string, string>;
    userId: string;
    isActiveClient: boolean;
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

export default function TailorCardUser({ initialMeasurements, userId, isActiveClient }: TailorCardUserProps) {
    const [measurements, setMeasurements] = useState<Record<string, string>>(initialMeasurements || {});
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const handleUpdate = async (key: string, value: string) => {
        const newMeasurements = { ...measurements, [key]: value };
        setMeasurements(newMeasurements);

        setSaving(true);
        const { error } = await supabase
            .from('tailor_cards')
            .upsert({
                user_id: userId,
                measurements: newMeasurements,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            toast.error("Failed to save measurement");
        }
        setSaving(false);
    };

    // -- LOCKED STATE --
    if (!isActiveClient) {
        return (
            <div className="relative h-full min-h-[500px] border border-ac-taupe/10 rounded-sm overflow-hidden group bg-white/40 backdrop-blur-md">
                <div className="absolute inset-0 bg-[#E6DED6] opacity-50" />

                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
                    <div className="w-12 h-12 bg-[#3D3630]/10 text-[#3D3630] rounded-full flex items-center justify-center mb-6">
                        <Lock size={20} />
                    </div>
                    <h3 className="font-serif text-2xl text-[#3D3630] mb-2">Technical Profile</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#3D3630]/60 mb-8 max-w-[200px]">
                        This card tracks metrics for your bespoke curation.
                    </p>
                    <Link
                        href="/vault/services"
                        className="text-[10px] font-bold uppercase tracking-widest text-[#3D3630] border-b border-[#3D3630]/20 hover:border-[#3D3630] transition-all pb-1"
                    >
                        Unlock via Services
                    </Link>
                </div>
            </div>
        );
    }

    // -- ACTIVE STATE --
    return (
        <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-8 h-full shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Ruler className="text-ac-gold" size={20} />
                    <h3 className="font-serif text-2xl text-ac-taupe">Tailor's Card</h3>
                </div>
                {saving && <Loader2 size={14} className="animate-spin text-ac-gold" />}
            </div>

            <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold mb-8 leading-relaxed">
                Your technical measurements card will appear here after you start a studio collaboration. You may also log them yourself below.
            </p>

            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                {MEASUREMENT_FIELDS.map((field) => (
                    <div key={field.key} className="group">
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2 group-focus-within:text-ac-gold transition-colors">
                            {field.label}
                        </label>
                        <input
                            type="text"
                            value={measurements[field.key] || ""}
                            onChange={(e) => handleUpdate(field.key, e.target.value)}
                            className="w-full bg-white/40 border border-ac-taupe/5 rounded-sm px-3 py-2 text-lg font-serif text-ac-taupe focus:outline-none focus:border-ac-gold focus:bg-white transition-all placeholder:text-ac-taupe/20"
                            placeholder="-"
                        />
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-8">
                <p className="text-[10px] text-ac-taupe/40 italic text-center">
                    These metrics help us curate the perfect fit for your digital wardrobe.
                </p>
            </div>
        </div>
    );
}
