"use client";

import { useState, useEffect } from "react";
import { User, Ruler, Shirt, Layout, ChevronRight, Menu, X, Check, Loader2, UserPlus, Archive } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import WardrobeSwitcher from "./WardrobeSwitcher";
import InvitationGenerator from "./InvitationGenerator";
import TailorCard from "./TailorCard";
import VirtualWardrobe from "./VirtualWardrobe";
import DigitalLookbook from "./DigitalLookbook";
import ArchiveManager from "./ArchiveManager";
import { updateProfileStatus } from "@/app/actions/studio";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import UserAssignmentModal from "./UserAssignmentModal";

interface StudioDashboardProps {
    locale: string;
}

export type StudioTab = 'tailor' | 'wardrobe' | 'lookbook';

export default function StudioDashboard({ locale }: StudioDashboardProps) {
    const [selectedWardrobe, setSelectedWardrobe] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<StudioTab>('wardrobe');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Assignment Modal State
    const [isAssigning, setIsAssigning] = useState(false);

    const [isAddingClient, setIsAddingClient] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [clientsVersion, setClientsVersion] = useState(0); // For forcing refetch

    const supabase = createClient();

    const tabs = [
        { id: 'tailor' as const, label: 'Tailor Card', icon: Ruler },
        { id: 'wardrobe' as const, label: 'Virtual Wardrobe', icon: Shirt },
        { id: 'lookbook' as const, label: 'Lookbook', icon: Layout },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar Switcher */}
            <div className={`
                lg:col-span-3 bg-white/40 backdrop-blur-md border border-white/50 rounded-sm p-4 h-fit
                ${mobileSidebarOpen ? 'fixed inset-0 z-50 bg-ac-sand !col-span-full' : 'hidden lg:block'}
            `}>
                <div className="flex justify-between items-center mb-6 lg:mb-4">
                    <h2 className="font-serif text-xl text-ac-taupe">Wardrobes</h2>
                    {mobileSidebarOpen && (
                        <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden text-ac-taupe">
                            <X size={24} />
                        </button>
                    )}
                </div>

                <div className="mb-4 space-y-2">
                    <button
                        onClick={() => setIsInviting(true)}
                        className="w-full flex items-center justify-center gap-2 bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] hover:bg-ac-taupe transition-all shadow-md"
                    >
                        <UserPlus size={14} />
                        New Invitation
                    </button>
                    <button
                        onClick={() => setIsArchiveOpen(true)}
                        className="w-full flex items-center justify-center gap-2 bg-ac-taupe/5 text-ac-taupe/40 py-2 border border-ac-taupe/5 rounded-sm font-bold uppercase tracking-widest text-[9px] hover:bg-ac-taupe/10 hover:text-ac-taupe transition-all"
                    >
                        <Archive size={12} />
                        Archive Manager
                    </button>
                </div>

                <WardrobeSwitcher
                    onSelect={(wardrobe: any) => {
                        setSelectedWardrobe(wardrobe);
                        setMobileSidebarOpen(false);
                    }}
                    onAddWardrobe={() => setIsAddingClient(true)}
                    selectedId={selectedWardrobe?.id}
                    key={clientsVersion}
                />
            </div>

            {/* Invitation Modal */}
            <AnimatePresence>
                {isInviting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/60 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full max-w-md"
                        >
                            <InvitationGenerator onClose={() => setIsInviting(false)} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Archive Modal */}
            <AnimatePresence>
                {isArchiveOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/60 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full max-w-2xl"
                        >
                            <ArchiveManager
                                onClose={() => setIsArchiveOpen(false)}
                                onRefresh={() => setClientsVersion(v => v + 1)}
                                locale={locale}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Client Modal */}
            <AnimatePresence>
                {isAddingClient && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-ac-taupe/60 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white max-w-md w-full p-8 rounded-sm shadow-2xl relative"
                        >
                            <button
                                onClick={() => setIsAddingClient(false)}
                                className="absolute top-4 right-4 text-ac-taupe/20 hover:text-ac-taupe transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="font-serif text-2xl text-ac-taupe mb-2">Create New Wardrobe</h3>
                            <p className="text-xs text-ac-taupe/40 uppercase tracking-widest font-bold mb-8">For styling projects or draft ideas</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Wardrobe Name</label>
                                    <input
                                        type="text"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        placeholder="E.g. Paris Capsule Ideas"
                                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-ac-gold transition-all"
                                    />
                                </div>

                                <button
                                    onClick={async () => {
                                        if (!newClientName) return;
                                        setIsCreating(true);

                                        // Create a wardrobe instead of a ghost profile
                                        const { createWardrobe } = await import("@/app/actions/wardrobes");
                                        const result = await createWardrobe(newClientName);

                                        if (result.success) {
                                            toast.success("Wardrobe created");
                                            setIsAddingClient(false);
                                            setNewClientName("");
                                            setClientsVersion(v => v + 1);
                                        } else {
                                            console.error(result.error);
                                            toast.error("Failed to create wardrobe");
                                        }
                                        setIsCreating(false);
                                    }}
                                    disabled={isCreating || !newClientName}
                                    className="w-full bg-ac-taupe text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-gold transition-all disabled:opacity-50"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    Create Wardrobe
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Sidebar Toggle */}
            <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-white/40 p-4 rounded-sm border border-white/50 text-ac-taupe mb-4"
            >
                <Menu size={20} />
                <span>{selectedWardrobe ? selectedWardrobe.title : 'Select Wardrobe'}</span>
            </button>

            {/* Main Workspace */}
            <div className="lg:col-span-9">
                <AnimatePresence mode="wait">
                    {!selectedWardrobe ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white/20 border-2 border-dashed border-ac-taupe/10 rounded-sm p-20 text-center"
                        >
                            <div className="w-16 h-16 bg-ac-taupe/5 rounded-full flex items-center justify-center mx-auto mb-6 text-ac-taupe/20">
                                <User size={32} />
                            </div>
                            <h3 className="font-serif text-2xl text-ac-taupe/40">Select a client to begin styling</h3>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={selectedWardrobe.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            {/* Wardrobe Header & Tab Navigation */}
                            <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-sm p-6 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-ac-taupe/10 rounded-full flex items-center justify-center text-ac-taupe">
                                            {selectedWardrobe.profiles?.avatar_url ? (
                                                <img src={selectedWardrobe.profiles.avatar_url} alt={selectedWardrobe.title} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <User size={32} />
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="font-serif text-3xl text-ac-taupe leading-none">
                                                {selectedWardrobe.title}
                                            </h2>
                                            <p className="text-xs uppercase tracking-widest text-ac-taupe/40 font-bold mt-1">
                                                {selectedWardrobe.profiles?.full_name || 'Unassigned'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsAssigning(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-ac-gold/10 text-ac-gold hover:bg-ac-gold/20 rounded-sm transition-all text-[10px] font-bold uppercase tracking-widest"
                                        >
                                            <UserPlus size={14} />
                                            {selectedWardrobe.profiles ? 'Reassign' : 'Assign Client'}
                                        </button>

                                        <button
                                            onClick={async () => {
                                                if (confirm(`Archive "${selectedWardrobe.title}"? It will be moved to the Archive Manager.`)) {
                                                    const { updateWardrobe } = await import("@/app/actions/wardrobes");
                                                    const res = await updateWardrobe(selectedWardrobe.id, { status: 'archived' });
                                                    if (res.success) {
                                                        toast.success("Wardrobe archived");
                                                        setSelectedWardrobe(null);
                                                        setClientsVersion(v => v + 1);
                                                    } else {
                                                        toast.error(res.error || "Failed to archive");
                                                    }
                                                }
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-ac-taupe/5 text-ac-taupe/40 hover:text-ac-taupe hover:bg-ac-taupe/10 rounded-sm transition-all text-[10px] font-bold uppercase tracking-widest"
                                        >
                                            <Archive size={14} />
                                            Archive
                                        </button>
                                    </div>
                                    <UserAssignmentModal
                                        isOpen={isAssigning}
                                        onClose={() => {
                                            setIsAssigning(false);
                                            setClientsVersion(v => v + 1);
                                        }}
                                        wardrobeId={selectedWardrobe.id}
                                        wardrobeTitle={selectedWardrobe.title}
                                    />
                                </div>

                                <div className="flex border-b border-ac-taupe/10">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`
                                                flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all
                                                ${activeTab === tab.id
                                                    ? 'text-ac-taupe border-b-2 border-ac-gold bg-ac-gold/5'
                                                    : 'text-ac-taupe/40 hover:text-ac-taupe/60'}
                                            `}
                                        >
                                            <tab.icon size={16} />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="min-h-[500px]">
                                {activeTab === 'tailor' && <TailorCard clientId={selectedWardrobe.id} />}
                                {activeTab === 'wardrobe' && <VirtualWardrobe clientId={selectedWardrobe.id} />}
                                {activeTab === 'lookbook' && <DigitalLookbook clientId={selectedWardrobe.id} />}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}


