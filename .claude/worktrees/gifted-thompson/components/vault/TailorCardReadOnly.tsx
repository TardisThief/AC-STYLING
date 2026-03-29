'use client';

import { Ruler } from 'lucide-react';

export default function TailorCardReadOnly({ measurements, updatedAt }: { measurements: any, updatedAt?: string }) {
    const fields = [
        { key: 'bust', label: 'Bust' },
        { key: 'waist', label: 'Waist' },
        { key: 'hips', label: 'Hips' },
        { key: 'inseam', label: 'Inseam' },
        { key: 'shoulder', label: 'Shoulder width' },
        { key: 'sleeve', label: 'Sleeve Length' },
    ];

    if (!measurements || Object.keys(measurements).length === 0) {
        return (
            <div className="bg-white/40 backdrop-blur-md border border-white/50 p-8 rounded-sm text-center h-full flex flex-col justify-center items-center">
                <div className="w-12 h-12 bg-ac-taupe/5 rounded-full flex items-center justify-center mb-4 text-ac-taupe/40">
                    <Ruler size={20} />
                </div>
                <h3 className="font-serif text-xl text-ac-taupe mb-2">The Perfect Fit</h3>
                <p className="text-xs text-ac-taupe/60 max-w-[200px] leading-relaxed">
                    Your technical measurements will appear here after your first fitting session.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-8 h-full shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-ac-taupe/10 pb-4">
                <Ruler className="text-ac-gold" size={20} />
                <div>
                    <h3 className="font-serif text-2xl text-ac-taupe">Tailor's Card</h3>
                    <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold">
                        Last Updated: {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                {fields.map(field => (
                    <div key={field.key} className="flex justify-between items-baseline border-b border-ac-taupe/5 pb-1">
                        <span className="text-xs uppercase tracking-widest text-ac-taupe/60 font-medium">
                            {field.label}
                        </span>
                        <span className="font-serif text-xl text-ac-taupe font-medium">
                            {measurements[field.key] || '-'}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-4 border-t border-ac-taupe/10">
                <p className="text-[10px] text-ac-taupe/40 italic text-center">
                    Reference these numbers for online shopping or custom alterations.
                </p>
            </div>
        </div>
    );
}
