"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell,
    Check,
    CheckCheck,
    Archive,
    RefreshCw,
    Loader2,
    Calendar,
    DollarSign,
    User,
    Phone,
    Mail,
    ChevronDown,
    Filter,
    ShoppingBag,
    MessageSquareReply
} from "lucide-react";
import {
    getAdminNotifications,
    markNotificationAsRead,
    updateNotificationStatus,
    markAllAsRead,
    type AdminNotification,
    type NotificationStatus
} from "@/app/actions/notifications";
import { answerQuestion } from "@/app/actions/send-question";
import { toast } from "sonner";

// Simple relative time helper
function formatDistanceToNow(date: Date | string) {
    const d = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Type icon mapping
const typeIcons: Record<string, React.ReactNode> = {
    'service_booking': <Calendar size={16} />,
    'masterclass_purchase': <DollarSign size={16} />,
    'course_sale': <DollarSign size={16} />,
    'offer_sale': <DollarSign size={16} />,
    'sale': <DollarSign size={16} />,
    'wardrobe_item': <ShoppingBag size={16} />,
    'general': <Bell size={16} />,
};

// Type colors
const typeColors: Record<string, string> = {
    'service_booking': 'bg-ac-olive/10 text-ac-olive', // Services = Olive
    'masterclass_purchase': 'bg-green-100 text-green-700', // Sales = Green
    'course_sale': 'bg-green-100 text-green-700',
    'offer_sale': 'bg-green-100 text-green-700',
    'sale': 'bg-green-100 text-green-700',
    'wardrobe_item': 'bg-blue-50 text-blue-600', // Inbox = Blue
    'general': 'bg-gray-100 text-gray-600',
};

type FilterTab = 'all' | 'sales' | 'services' | 'inbox' | 'questions';

export default function AdminNotificationsPanel() {
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [showRead, setShowRead] = useState(false); // Default to unread only initially? Or generic filter.

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        // Load ALL notifications initially to allow client-side filtering responsiveness
        // Optimization: In a huge app, we'd filter on backend. Here, volume is manageable.
        const res = await getAdminNotifications();
        if (res.success) {
            setNotifications(res.data || []);
        } else {
            toast.error("Failed to load notifications");
        }
        setLoading(false);
    };

    const handleMarkRead = async (id: string, type?: string) => {
        setProcessingId(id);
        // Cast type to NotificationType
        const res = await markNotificationAsRead(id, type as any);
        if (res.success) {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, status: 'read' } : n)
            );
        } else {
            toast.error(res.error || "Failed to mark as read");
        }
        setProcessingId(null);
    };

    const handleTakeAction = async (id: string, action: string, type?: string) => {
        setProcessingId(id);
        const res = await updateNotificationStatus(id, 'actioned', action, type as any);
        if (res.success) {
            toast.success(`Marked as ${action}`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, status: 'actioned', action_taken: action } : n)
            );
        } else {
            toast.error(res.error || "Failed to update");
        }
        setProcessingId(null);
    };

    const handleAnswerReply = async (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, status: 'read', action_taken: 'answered' } : n)
        );
    };

    const handleMarkAllRead = async () => {
        const res = await markAllAsRead();
        if (res.success) {
            toast.success("All marked as read");
            setNotifications(prev =>
                prev.map(n => n.status === 'unread' ? { ...n, status: 'read' } : n)
            );
        } else {
            toast.error(res.error || "Failed");
        }
    };

    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    // Filter Logic
    const filteredNotifications = notifications.filter(n => {
        // 1. Status Filter
        if (showUnreadOnly && n.status !== 'unread') {
            return false;
        }

        // 2. Tab Filter
        if (activeTab === 'sales') {
            return ['masterclass_purchase', 'course_sale', 'offer_sale', 'sale'].includes(n.type);
        }
        if (activeTab === 'services') {
            return n.type === 'service_booking';
        }
        if (activeTab === 'inbox') {
            return ['wardrobe_item', 'general'].includes(n.type);
        }
        if (activeTab === 'questions') {
            return n.type === 'question';
        }
        return true;
    });

    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    if (loading) {
        return (
            <div className="p-12 text-center text-ac-taupe/40 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin" />
                Fetching notifications...
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="font-serif text-2xl text-ac-taupe">Notifications</h2>
                    {unreadCount > 0 && (
                        <span className="bg-ac-gold text-white text-xs font-bold px-2 py-1 rounded-full">
                            {unreadCount} new
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-2 ${showUnreadOnly
                            ? 'bg-ac-taupe text-white border-ac-taupe'
                            : 'text-ac-taupe/60 border-ac-taupe/20 hover:border-ac-taupe/40'
                            }`}
                    >
                        <Filter size={12} />
                        {showUnreadOnly ? 'Showing Unread' : 'Filter Unread'}
                    </button>

                    <div className="h-4 w-px bg-ac-taupe/20"></div>

                    <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-ac-taupe/60 hover:text-ac-gold transition-colors flex items-center gap-1"
                    >
                        <CheckCheck size={14} /> Mark all read
                    </button>
                    <button
                        onClick={loadNotifications}
                        className="p-2 text-ac-taupe/40 hover:text-ac-gold transition-colors"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-ac-taupe/10 pb-1">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'sales', label: 'Sales' },
                    { id: 'services', label: 'Services' },
                    { id: 'inbox', label: 'Wardrobe' },
                    { id: 'questions', label: 'Q&A' }, // Added Q&A tab
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as FilterTab)}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === tab.id
                            ? 'text-ac-taupe'
                            : 'text-ac-taupe/40 hover:text-ac-taupe/70'
                            }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-[-5px] left-0 right-0 h-[2px] bg-ac-gold"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {filteredNotifications.length === 0 && (
                <div className="p-16 text-center border-2 border-dashed border-ac-taupe/10 rounded-sm">
                    <div className="inline-block p-4 bg-ac-olive/10 rounded-full mb-4 text-ac-olive">
                        <Bell size={32} />
                    </div>
                    <h3 className="font-serif text-2xl text-ac-taupe mb-2">All caught up!</h3>
                    <p className="text-ac-taupe/60">No notifications in this category.</p>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                <AnimatePresence mode='popLayout'>
                    {filteredNotifications.map((notification) => (
                        <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onMarkRead={handleMarkRead}
                            onTakeAction={handleTakeAction}
                            isProcessing={processingId === notification.id}
                            onAnswerReply={handleAnswerReply}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function NotificationCard({
    notification,
    onMarkRead,
    onTakeAction,
    isProcessing,
    onAnswerReply,
}: {
    notification: AdminNotification;
    onMarkRead: (id: string, type?: string) => void;
    onTakeAction: (id: string, action: string, type?: string) => void;
    isProcessing: boolean;
    onAnswerReply: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);
    const [replyText, setReplyText] = useState("");
    const isUnread = notification.status === 'unread';
    const isActioned = notification.status === 'actioned';
    const isQuestion = notification.type === 'question';

    const metadata = notification.metadata || {};

    const handleReply = async () => {
        if (!replyText.trim()) return;

        // Optimistic UI update could go here, but for now we wait
        const res = await answerQuestion(notification.reference_id!, replyText);

        if (res.success) {
            toast.success("Answer sent!");
            setReplying(false);
            setReplyText("");
            setReplyText("");
            onMarkRead(notification.id); // Also mark notification as read
            onAnswerReply(notification.id); // Update UI to show 'Answered'
        } else {
            toast.error(res.error || "Failed to send answer");
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`relative bg-white rounded-sm shadow-sm border transition-all ${isUnread ? 'border-ac-gold/30 bg-ac-gold/5' : 'border-ac-taupe/10'
                } ${isActioned ? 'opacity-60' : ''}`}
        >
            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-sm">
                    <Loader2 className="animate-spin text-ac-gold" />
                </div>
            )}

            {/* Main Content */}
            <div
                className="p-4 cursor-pointer"
                onClick={() => {
                    setExpanded(!expanded);
                    if (isUnread) onMarkRead(notification.id, notification.type);
                }}
            >
                <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`p-2 rounded-full ${typeColors[notification.type] || typeColors['general']}`}>
                        {typeIcons[notification.type] || (isQuestion ? <MessageSquareReply size={16} /> : typeIcons['general'])}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className={`font-medium text-ac-taupe truncate ${isUnread ? 'font-semibold' : ''}`}>
                                {notification.title}
                            </h4>
                            <span className="text-[10px] text-ac-taupe/40 uppercase tracking-wider whitespace-nowrap">
                                {formatDistanceToNow(notification.created_at)}
                            </span>
                        </div>

                        {/* Client Name */}
                        {notification.profiles?.full_name && (
                            <p className="text-xs text-ac-taupe/60 mt-0.5 flex items-center gap-1">
                                <User size={10} /> {notification.profiles.full_name}
                            </p>
                        )}

                        {/* Status Badge */}
                        {isActioned && notification.action_taken && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-ac-olive/10 text-ac-olive text-[10px] uppercase tracking-wider rounded-sm">
                                {notification.action_taken}
                            </span>
                        )}
                        {/* Specifically for Q&A, if we replied, show Answered even if read implies it */}
                        {!isActioned && notification.type === 'question' && notification.action_taken === 'answered' && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] uppercase tracking-wider rounded-sm">
                                Answered
                            </span>
                        )}
                    </div>

                    {/* Expand Icon */}
                    <ChevronDown
                        size={16}
                        className={`text-ac-taupe/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4 border-t border-ac-taupe/10"
                >
                    {/* Message */}
                    {notification.message && (
                        <p className="text-sm text-ac-taupe/80 mt-3 whitespace-pre-line">
                            {notification.message}
                        </p>
                    )}

                    {/* Metadata */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ac-taupe/60">
                        {metadata.email && (
                            <div className="flex items-center gap-1">
                                <Mail size={12} /> {metadata.email}
                            </div>
                        )}
                        {metadata.phone && (
                            <div className="flex items-center gap-1">
                                <Phone size={12} /> {metadata.phone}
                            </div>
                        )}
                        {metadata.amount && (
                            <div className="flex items-center gap-1 font-semibold text-ac-taupe">
                                <DollarSign size={12} /> {metadata.amount} {metadata.currency || 'USD'}
                            </div>
                        )}
                        {metadata.serviceTitle && (
                            <div className="flex items-center gap-1 col-span-2">
                                <span className="font-semibold text-[10px] uppercase tracking-wider">Product:</span> {metadata.serviceTitle}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {!isActioned && notification.type === 'service_booking' && (
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onTakeAction(notification.id, 'scheduled', notification.type); }}
                                className="flex-1 py-2 bg-ac-taupe text-white text-xs uppercase tracking-widest rounded-sm hover:bg-ac-gold transition-colors"
                            >
                                Mark Scheduled
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onTakeAction(notification.id, 'completed', notification.type); }}
                                className="flex-1 py-2 bg-ac-olive/10 text-ac-olive text-xs uppercase tracking-widest rounded-sm hover:bg-ac-olive hover:text-white transition-colors"
                            >
                                Mark Completed
                            </button>
                        </div>
                    )}

                    {/* Wardrobe Items Actions */}
                    {!isActioned && notification.type === 'wardrobe_item' && (
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id, notification.type); }}
                                className="flex-1 py-2 bg-ac-olive text-white text-xs uppercase tracking-widest rounded-sm hover:bg-ac-olive/90 transition-colors"
                            >
                                Keep/Approve
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onTakeAction(notification.id, 'donate', notification.type); }}
                                className="flex-1 py-2 bg-ac-taupe/10 text-ac-taupe text-xs uppercase tracking-widest rounded-sm hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                                Donate
                            </button>
                        </div>
                    )}

                    {/* Q&A Reply Action */}
                    {isQuestion && (
                        <div className="mt-4">
                            {!replying ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setReplying(true); }}
                                    className="w-full py-2 bg-ac-gold/10 text-ac-gold border border-ac-gold/20 text-xs uppercase tracking-widest rounded-sm hover:bg-ac-gold hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <MessageSquareReply size={14} /> Reply to User
                                </button>
                            ) : (
                                <div className="bg-ac-taupe/5 p-3 rounded-sm border border-ac-taupe/10" onClick={(e) => e.stopPropagation()}>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Type your answer here..."
                                        className="w-full bg-white border border-ac-taupe/20 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold mb-2"
                                        rows={3}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setReplying(false)}
                                            className="text-xs text-ac-taupe/60 hover:text-ac-taupe px-3 py-1"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleReply}
                                            disabled={!replyText.trim()}
                                            className="text-xs bg-ac-gold text-white px-3 py-1 rounded-sm hover:bg-ac-gold/90 disabled:opacity-50"
                                        >
                                            Send Answer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </motion.div>
            )}
        </motion.div>
    );
}
