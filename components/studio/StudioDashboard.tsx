"use client";

import { useState } from "react";
import type { Wardrobe } from "@/app/lib/types";
import { User, Ruler, Shirt, Layout, Menu, X, Check, Loader2, UserPlus, Archive } from "lucide-react";
import WardrobeSwitcher from "./WardrobeSwitcher";
import InvitationGenerator from "./InvitationGenerator";
import TailorCard from "./TailorCard";
import VirtualWardrobe from "./VirtualWardrobe";
import DigitalLookbook from "./DigitalLookbook";
import ArchiveManager from "./ArchiveManager";
import { createWardrobe } from "@/app/actions/wardrobes";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import UserAssignmentModal from "./UserAssignmentModal";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SafeImage from "@/components/ui/SafeImage";

interface StudioDashboardProps {
    locale: string;
}

export type StudioTab = 'tailor' | 'wardrobe' | 'lookbook';

export default function StudioDashboard({ locale }: StudioDashboardProps) {
    const [selectedWardrobe, setSelectedWardrobe] = useState<Wardrobe | null>(null);
    const [activeTab, setActiveTab] = useState<StudioTab>('wardrobe');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Assignment Modal State
    const [isAssigning, setIsAssigning] = useState(false);

    const [isAddingClient, setIsAddingClient] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [pendingArchive, setPendingArchive] = useState<{ id: string; title: string } | null>(null);
    const [clientsVersion, setClientsVersion] = useState(0); // For forcing refetch

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
                        <button
                            onClick={() => setMobileSidebarOpen(false)}
                            aria-label="Close wardrobe list"
                            className="lg:hidden text-ac-taupe"
                        >
                            <X size={24} aria-hidden="true" />
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
                    onSelect={(wardrobe: Wardrobe) => {
                        setSelectedWardrobe(wardrobe);
                        setMobileSidebarOpen(false);
                    }}
                    onAddWardrobe={() => setIsAddingClient(true)}
                    selectedId={selectedWardrobe?.id}
                    key={clientsVersion}
                />
            </div>

            {/* Invitation Modal */}
            <Modal
                isOpen={isInviting}
                onClose={() => setIsInviting(false)}
                title="New Invitation"
                hideTitle
                widthClass="max-w-md"
                panelClassName="bg-transparent shadow-none"
            >
                <InvitationGenerator onClose={() => setIsInviting(false)} />
            </Modal>

            {/* Archive Modal */}
            <Modal
                isOpen={isArchiveOpen}
                onClose={() => setIsArchiveOpen(false)}
                title="Archive Manager"
                hideTitle
                widthClass="max-w-2xl"
                panelClassName="bg-transparent shadow-none"
            >
                <ArchiveManager
                    onClose={() => setIsArchiveOpen(false)}
                    onRefresh={() => setClientsVersion(v => v + 1)}
                    locale={locale}
                />
            </Modal>

            {/* Add Wardrobe Modal */}
            <Modal
                isOpen={isAddingClient}
                onClose={() => setIsAddingClient(false)}
                title="Create New Wardrobe"
                subtitle="For styling projects or draft ideas"
                widthClass="max-w-md"
            >
                <div className="p-8 pt-6 space-y-6">
                    <div>
                        <label htmlFor="wardrobeName" className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Wardrobe Name</label>
                        <input
                            id="wardrobeName"
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

                            const result = await createWardrobe(newClientName);

                            if (result.success) {
                                toast.success("Wardrobe created");
                                setIsAddingClient(false);
                                setNewClientName("");
                                setClientsVersion(v => v + 1);
                            } else {
                                toast.error(result.error || "Failed to create wardrobe");
                            }
                            setIsCreating(false);
                        }}
                        disabled={isCreating || !newClientName}
                        className="w-full bg-ac-taupe text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-offset-2 transition-all disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                        Create Wardrobe
                    </button>
                </div>
            </Modal>

            {/* Archive confirmation */}
            <ConfirmDialog
                isOpen={pendingArchive !== null}
                onCancel={() => setPendingArchive(null)}
                onConfirm={async () => {
                    if (!pendingArchive) return;
                    const { updateWardrobe } = await import("@/app/actions/wardrobes");
                    const res = await updateWardrobe(pendingArchive.id, { status: 'archived' });
                    if (res.success) {
                        toast.success("Wardrobe archived");
                        setSelectedWardrobe(null);
                        setClientsVersion(v => v + 1);
                    } else {
                        toast.error(res.error || "Failed to archive");
                    }
                    setPendingArchive(null);
                }}
                title="Archive wardrobe"
                body={<>&ldquo;{pendingArchive?.title}&rdquo; moves to the Archive Manager. Its items are kept, and you can restore it later.</>}
                confirmLabel="Archive"
            />

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
                                        <div className="w-16 h-16 bg-ac-taupe/10 rounded-full flex items-center justify-center text-ac-taupe overflow-hidden">
                                            {selectedWardrobe.profiles?.avatar_url ? (
                                                <SafeImage src={selectedWardrobe.profiles.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <User size={32} aria-hidden="true" />
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="font-serif text-3xl text-ac-taupe leading-none">
                                                {selectedWardrobe.title}
                                            </h2>
                                            <p className="text-xs uppercase tracking-widest text-ac-taupe/40 font-bold mt-1">
                                                {selectedWardrobe.profiles?.full_name || selectedWardrobe.profiles?.email || 'Unassigned'}
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
                                            onClick={() => setPendingArchive({ id: selectedWardrobe.id, title: selectedWardrobe.title })}
                                            className="flex items-center gap-2 px-4 py-2 bg-ac-taupe/5 text-ac-taupe/40 hover:text-ac-taupe hover:bg-ac-taupe/10 rounded-sm transition-all text-[10px] font-bold uppercase tracking-widest"
                                        >
                                            <Archive size={14} aria-hidden="true" />
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

                                {/* The label is visually hidden on narrow screens, not removed —
                                    an icon-only tab with no accessible name is unusable. */}
                                <div role="tablist" aria-label="Studio sections" className="flex border-b border-ac-taupe/10">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            role="tab"
                                            id={`studio-tab-${tab.id}`}
                                            aria-selected={activeTab === tab.id}
                                            aria-controls={`studio-panel-${tab.id}`}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`
                                                flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all
                                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold focus-visible:ring-inset
                                                ${activeTab === tab.id
                                                    ? 'text-ac-taupe border-b-2 border-ac-gold bg-ac-gold/5'
                                                    : 'text-ac-taupe/40 hover:text-ac-taupe/60'}
                                            `}
                                        >
                                            <tab.icon size={16} aria-hidden="true" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                            <span className="sr-only sm:hidden">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div
                                role="tabpanel"
                                id={`studio-panel-${activeTab}`}
                                aria-labelledby={`studio-tab-${activeTab}`}
                                tabIndex={0}
                                className="min-h-[500px] focus-visible:outline-none"
                            >
                                {activeTab === 'tailor' && <TailorCard wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
                                {activeTab === 'wardrobe' && <VirtualWardrobe wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
                                {activeTab === 'lookbook' && <DigitalLookbook wardrobeId={selectedWardrobe.id} ownerId={selectedWardrobe.owner_id ?? null} />}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}


