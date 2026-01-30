"use client";

import { Edit, Trash2, Check, X as XIcon, DollarSign } from "lucide-react";

interface ServicesListProps {
    services: any[];
    onEdit: (service: any) => void;
    onDelete: (id: string) => void;
}

export default function ServicesList({ services, onEdit, onDelete }: ServicesListProps) {
    if (services.length === 0) {
        return (
            <div className="text-center py-12 text-ac-taupe/40 border-2 border-dashed border-ac-taupe/10 rounded-sm">
                No services found. Create one to start offering sessions.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
                <div key={service.id} className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-sm overflow-hidden group hover:border-ac-gold/30 transition-all flex flex-col">
                    <div className="aspect-[3/4] bg-ac-taupe/10 relative">
                        {service.image_url ? (
                            <img src={service.image_url} alt={service.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-ac-taupe/20">
                                <span className="font-serif italic">No image</span>
                            </div>
                        )}

                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(service)}
                                className="bg-white/90 p-2 rounded-full text-ac-olive hover:text-ac-gold shadow-sm"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => onDelete(service.id)}
                                className="bg-white/90 p-2 rounded-full text-red-500 hover:text-red-700 shadow-sm"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                            <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold rounded-sm ${service.active ? 'bg-ac-olive/90 text-white' : 'bg-ac-taupe/50 text-white'
                                }`}>
                                {service.active ? 'Active' : 'Draft'}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                        <div className="mb-2">
                            <h3 className="font-serif text-xl text-ac-taupe leading-tight">{service.title}</h3>
                            {service.subtitle && <p className="text-xs text-ac-taupe/60 italic mt-1">{service.subtitle}</p>}
                        </div>

                        <p className="text-sm text-ac-taupe/80 line-clamp-3 mb-4 flex-1">
                            {service.description}
                        </p>

                        <div className="pt-4 border-t border-ac-taupe/10 space-y-2">
                            <div className="flex justify-between items-center text-xs text-ac-taupe/60 uppercase tracking-widest">
                                <span>Type: {service.type}</span>
                                <span className="font-bold text-ac-taupe">{service.price_display}</span>
                            </div>

                            {service.recommendation_tags && service.recommendation_tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {service.recommendation_tags.map((tag: string) => (
                                        <span key={tag} className="text-[10px] bg-ac-taupe/5 px-2 py-0.5 rounded-full text-ac-taupe/60">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
