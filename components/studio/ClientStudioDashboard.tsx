"use client";

import { useState } from "react";
import { Shirt, BookOpen, Ruler, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VirtualWardrobe from "@/components/studio/VirtualWardrobe";
import DigitalLookbook from "@/components/studio/DigitalLookbook";
import TailorCardUser from "@/components/vault/TailorCardUser";

interface ClientStudioDashboardProps {
    wardrobeId: string;
    ownerId: string;
    initialMeasurements: Record<string, string>;
    userName: string;
}

export default function ClientStudioDashboard({ wardrobeId, ownerId, initialMeasurements, userName }: ClientStudioDashboardProps) {
    const [activeTab, setActiveTab] = useState<'lookbooks' | 'wardrobe'>('lookbooks');
    const [isTailorCardOpen, setIsTailorCardOpen] = useState(false);

    return (
        <div className="min-h-screen bg-ac-sand/30 pb-20">
            {/* Header */}
            <header className="bg-white/60 backdrop-blur-md border-b border-ac-taupe/5 sticky top-20 z-40">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="font-serif text-2xl text-ac-taupe">Personal Studio</h1>
                        <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold">
                            Welcome, {userName}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-ac-taupe/5 p-1 rounded-sm">
                        <button
                            onClick={() => setActiveTab('lookbooks')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'lookbooks' ? 'bg-white text-ac-taupe shadow-sm' : 'text-ac-taupe/40 hover:text-ac-taupe'}`}
                        >
                            <BookOpen size={14} />
                            Lookbooks
                        </button>
                        <button
                            onClick={() => setActiveTab('wardrobe')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'wardrobe' ? 'bg-white text-ac-taupe shadow-sm' : 'text-ac-taupe/40 hover:text-ac-taupe'}`}
                        >
                            <Shirt size={14} />
                            Wardrobe
                        </button>
                        <div className="w-px h-4 bg-ac-taupe/20 hidden md:block" />
                        <button
                            onClick={() => setIsTailorCardOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all text-ac-taupe/40 hover:bg-white hover:text-ac-taupe"
                        >
                            <Ruler size={14} />
                            Measurements
                        </button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                {/* Main Content Area */}
                <div className="w-full">
                    <AnimatePresence mode="wait">
                        {activeTab === 'lookbooks' ? (
                            <motion.div
                                key="lookbooks"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <DigitalLookbook wardrobeId={wardrobeId} ownerId={ownerId} isClientView={true} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="wardrobe"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <VirtualWardrobe wardrobeId={wardrobeId} ownerId={ownerId} isClientView={true} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Tailor Card Modal */}
            <AnimatePresence>
                {isTailorCardOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/80 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white max-w-lg w-full max-h-[90vh] rounded-sm shadow-2xl overflow-y-auto relative custom-scrollbar"
                        >
                            <button
                                onClick={() => setIsTailorCardOpen(false)}
                                className="absolute top-6 right-6 z-50 text-ac-taupe/40 hover:text-ac-taupe transition-colors bg-white/50 backdrop-blur-sm rounded-full p-1"
                            >
                                <X size={24} />
                            </button>

                            <div className="p-8 space-y-8">
                                <div className="pr-12">
                                    <h3 className="font-serif text-3xl text-ac-taupe">Your Measurements</h3>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 mt-1">Review your tailoring profile</p>
                                </div>

                                <div className="h-fit">
                                    <TailorCardUser
                                        userId={ownerId}
                                        initialMeasurements={initialMeasurements}
                                        isActiveClient={true} // Always true here since route is protected
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
