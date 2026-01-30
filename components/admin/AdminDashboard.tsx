"use client";

import { useState, useEffect, useRef } from "react";
import ChapterForm from "./ChapterForm";
import ChaptersTable from "./ChaptersTable";
import MasterclassForm from "./MasterclassForm";
import OfferForm from "./OfferForm"; // Generic offer form
import BoutiqueManager from "./BoutiqueManager";
import ClientList from "./ClientList";
import ClientDossier from "./ClientDossier";
import { getServices, deleteService } from "@/app/actions/admin/manage-services";
import { getChapters, deleteChapter } from "@/app/actions/admin/manage-chapters";
import { getMasterclasses, deleteMasterclass } from "@/app/actions/admin/manage-masterclasses";
import ServicesList from "./ServicesList";
import ServiceForm from "./ServiceForm";
import { toast } from "sonner";
import { Folder, FileVideo, Plus, Users, Tag, Sparkles } from "lucide-react";

import StudioInbox from "./StudioInbox";
import AdminNotificationsPanel from "./AdminNotificationsPanel";
import { getUnreadNotificationCount } from "@/app/actions/notifications";

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'inbox' | 'notifications' | 'masterclasses' | 'chapters' | 'clients' | 'boutique' | 'services'>('notifications');

    // Data
    const [chapters, setChapters] = useState<any[]>([]);
    const [masterclasses, setMasterclasses] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    // Inbox Count
    const [inboxCount, setInboxCount] = useState(0);
    // Notifications Count
    const [notificationsCount, setNotificationsCount] = useState(0);

    // Forms & Modals
    const [isCreating, setIsCreating] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    // Offer Management State
    const [editingOfferSlug, setEditingOfferSlug] = useState<string | null>(null);

    const formRef = useRef<HTMLDivElement>(null);

    const loadData = async () => {
        // Dynamically import to separate concerns? Or just call directly.
        // We need getStudioInboxItems for the count.
        const { getStudioInboxItems } = await import("@/app/actions/studio");

        const [cRes, mRes, sRes, iRes] = await Promise.all([
            getChapters(),
            getMasterclasses(),
            getServices(),
            getStudioInboxItems()
        ]);

        if (cRes.success) setChapters(cRes.chapters || []);
        if (mRes.success) setMasterclasses(mRes.masterclasses || []);
        if (sRes.success) setServices(sRes.services || []);
        if (iRes.success) setInboxCount(iRes.data?.length || 0);

        // Fetch notification count separately
        const notifCount = await getUnreadNotificationCount();
        setNotificationsCount(notifCount);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Scroll to form when editing
    useEffect(() => {
        if ((editingItem || isCreating || editingOfferSlug) && formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [editingItem, isCreating, editingOfferSlug]);

    const handleSuccess = () => {
        loadData();
        setEditingItem(null);
        setIsCreating(false);
        setEditingOfferSlug(null);
    };

    const handleDeleteMasterclass = async (id: string, title: string) => {
        if (!confirm(`Delete masterclass "${title}" and ALL its chapters?`)) return;
        const res = await deleteMasterclass(id);
        if (res.success) {
            toast.success("Masterclass deleted");
            loadData();
        } else {
            toast.error(res.error || "Failed to delete");
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm("Are you sure you want to delete this service?")) return;
        const res = await deleteService(id);
        if (res.success) {
            toast.success("Service deleted");
            loadData();
        } else {
            toast.error(res.error || "Failed to delete");
        }
    };

    return (
        <div className="space-y-8">
            {/* Tabs */}
            <div className="flex gap-4 border-b border-ac-taupe/10 overflow-x-auto">
                <button
                    onClick={() => { setActiveTab('inbox'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'inbox'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <div className="relative">
                        <Users size={18} className="rotate-180" /> {/* Mock Inbox Icon */}
                        {inboxCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-ac-gold text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                {inboxCount}
                            </span>
                        )}
                    </div>
                    Inbox
                </button>
                <button
                    onClick={() => { setActiveTab('notifications'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'notifications'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <div className="relative">
                        <Sparkles size={18} />
                        {notificationsCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                                {notificationsCount}
                            </span>
                        )}
                    </div>
                    Notify
                </button>
                <button
                    onClick={() => { setActiveTab('masterclasses'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'masterclasses'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <Folder size={18} />
                    Masterclasses
                </button>
                <button
                    onClick={() => { setActiveTab('chapters'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'chapters'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <FileVideo size={18} />
                    Chapters
                </button>
                <button
                    onClick={() => { setActiveTab('services'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'services'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <Sparkles size={18} />
                    Services
                </button>
                <button
                    onClick={() => { setActiveTab('boutique'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'boutique'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <Tag size={18} />
                    Boutique
                </button>
                <button
                    onClick={() => { setActiveTab('clients'); setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }}
                    className={`pb-4 px-4 flex items-center gap-2 font-serif text-sm md:text-lg transition-colors whitespace-nowrap ${activeTab === 'clients'
                        ? 'text-ac-taupe border-b-2 border-ac-gold'
                        : 'text-ac-taupe/40 hover:text-ac-taupe/60'
                        }`}
                >
                    <Users size={18} />
                    Clients
                </button>
            </div>

            {/* Action Bar */}
            {
                activeTab !== 'clients' && activeTab !== 'boutique' && activeTab !== 'inbox' && (
                    <div className="flex justify-between items-center">
                        <h2 className="font-serif text-3xl text-ac-taupe">
                            {activeTab === 'masterclasses' ? 'Masterclass Collections' :
                                activeTab === 'chapters' ? 'Video Chapters' :
                                    'Strategic Services'}
                        </h2>
                        <div className="flex gap-3">
                            {activeTab === 'masterclasses' && (
                                <button
                                    onClick={() => { setEditingOfferSlug('full_access'); setEditingItem(null); setIsCreating(false); }}
                                    className="flex items-center gap-2 border border-ac-gold text-ac-gold px-4 py-2 rounded-sm hover:bg-ac-gold/10 transition-colors"
                                >
                                    <Sparkles size={18} />
                                    Full Access
                                </button>
                            )}
                            {activeTab === 'chapters' && (
                                <button
                                    onClick={() => { setEditingOfferSlug('course_pass'); setEditingItem(null); setIsCreating(false); }}
                                    className="flex items-center gap-2 border border-ac-gold text-ac-gold px-4 py-2 rounded-sm hover:bg-ac-gold/10 transition-colors"
                                >
                                    <Tag size={18} />
                                    Course Pass
                                </button>
                            )}
                            <button
                                onClick={() => { setIsCreating(true); setEditingItem(null); setEditingOfferSlug(null); }}
                                className="flex items-center gap-2 bg-ac-taupe text-white px-4 py-2 rounded-sm hover:bg-ac-taupe/90 transition-colors"
                            >
                                <Plus size={18} />
                                Create New
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Form Area */}
            {
                (isCreating || editingItem || editingOfferSlug) && activeTab !== 'clients' && activeTab !== 'boutique' && activeTab !== 'inbox' && (
                    <div ref={formRef} className="bg-white/40 backdrop-blur-md border border-ac-gold shadow-lg rounded-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif text-xl text-ac-taupe">
                                {editingOfferSlug ? 'Offer Settings' : (editingItem ? 'Edit Item' : 'New Item')}
                            </h3>
                            <button onClick={() => { setIsCreating(false); setEditingItem(null); setEditingOfferSlug(null); }} className="text-sm text-ac-taupe/60">Close</button>
                        </div>

                        {editingOfferSlug ? (
                            <OfferForm
                                slug={editingOfferSlug}
                                initialTitle={editingOfferSlug === 'full_access' ? "AC Styling: The Full Vault" : "Course Pass"}
                                initialDescription={editingOfferSlug === 'full_access' ? "Complete access to all Masterclasses." : "Unlock all standalone courses/lessons."}
                                onClose={handleSuccess}
                            />
                        ) : activeTab === 'masterclasses' ? (
                            <MasterclassForm
                                masterclass={editingItem}
                                onSuccess={handleSuccess}
                                onCancel={() => { setIsCreating(false); setEditingItem(null); }}
                            />
                        ) : activeTab === 'chapters' ? (
                            <ChapterForm
                                chapter={editingItem}
                                onSuccess={handleSuccess}
                                onCancel={() => { setIsCreating(false); setEditingItem(null); }}
                            />
                        ) : (
                            <ServiceForm
                                service={editingItem}
                                onSuccess={handleSuccess}
                                onCancel={() => { setIsCreating(false); setEditingItem(null); }}
                            />
                        )}
                    </div>
                )
            }

            {/* Views */}
            {
                activeTab === 'inbox' && (
                    <StudioInbox />
                )
            }

            {
                activeTab === 'notifications' && (
                    <AdminNotificationsPanel />
                )
            }

            {
                activeTab === 'masterclasses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {masterclasses.map((mc) => (
                            <div key={mc.id} className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-sm overflow-hidden group">
                                <div className="aspect-video bg-ac-taupe/10 relative">
                                    {mc.thumbnail_url && (
                                        <img src={mc.thumbnail_url} alt={mc.title} className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingItem(mc)} className="bg-white/90 p-2 rounded-full text-ac-olive hover:text-ac-gold shadow-sm">Edit</button>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <h3 className="font-serif text-xl text-ac-taupe mb-1">{mc.title}</h3>
                                    <p className="text-sm text-ac-taupe/60 line-clamp-2 mb-4">{mc.description}</p>
                                    <div className="flex justify-between items-center border-t border-ac-taupe/10 pt-4">
                                        <span className="text-xs uppercase tracking-widest text-ac-taupe/40">Includes chapters</span>
                                        <button onClick={() => handleDeleteMasterclass(mc.id, mc.title)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {masterclasses.length === 0 && (
                            <div className="col-span-full text-center py-12 text-ac-taupe/40 border-2 border-dashed border-ac-taupe/10 rounded-sm">
                                No masterclasses found. Create one to group your chapters.
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeTab === 'chapters' && (
                    <div className="bg-white/40 backdrop-blur-md border border-white/30 rounded-sm p-6">
                        <ChaptersTable
                            chapters={chapters}
                            onEdit={(c) => setEditingItem(c)}
                            onDelete={loadData}
                        />
                    </div>
                )
            }

            {
                activeTab === 'clients' && (
                    <ClientList onSelectClient={(c) => setSelectedClient(c)} />
                )
            }

            {
                activeTab === 'boutique' && (
                    <BoutiqueManager />
                )
            }

            {
                activeTab === 'services' && (
                    <ServicesList
                        services={services}
                        onEdit={(s) => { setActiveTab('services'); setEditingItem(s); }}
                        onDelete={handleDeleteService}
                    />
                )
            }

            {/* Modal: Client Dossier */}
            {
                selectedClient && (
                    <ClientDossier
                        client={selectedClient}
                        onClose={() => setSelectedClient(null)}
                    />
                )
            }
        </div>
    );
}
