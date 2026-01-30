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
    Filter
} from "lucide-react";
import {
    getAdminNotifications,
    markNotificationAsRead,
    updateNotificationStatus,
    markAllAsRead,
    type AdminNotification,
    type NotificationStatus
} from "@/app/actions/notifications";
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
    'sale': <DollarSign size={16} />,
    'general': <Bell size={16} />,
};

// Type colors
const typeColors: Record<string, string> = {
    'service_booking': 'bg-blue-100 text-blue-600',
    'masterclass_purchase': 'bg-green-100 text-green-600',
    'sale': 'bg-emerald-100 text-emerald-600',
    'general': 'bg-gray-100 text-gray-600',
};

export default function AdminNotificationsPanel() {
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadNotifications();
    }, [filter]);

    const loadNotifications = async () => {
        setLoading(true);
        const filterParams = filter === 'unread' ? { status: 'unread' as NotificationStatus } : undefined;
        const res = await getAdminNotifications(filterParams);
        if (res.success) {
            setNotifications(res.data || []);
        } else {
            toast.error("Failed to load notifications");
        }
        setLoading(false);
    };

    const handleMarkRead = async (id: string) => {
        setProcessingId(id);
        const res = await markNotificationAsRead(id);
        if (res.success) {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, status: 'read' } : n)
            );
        } else {
            toast.error(res.error || "Failed to mark as read");
        }
        setProcessingId(null);
    };

    const handleTakeAction = async (id: string, action: string) => {
        setProcessingId(id);
        const res = await updateNotificationStatus(id, 'actioned', action);
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
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-ac-taupe/60 hover:text-ac-gold transition-colors flex items-center gap-1"
                        >
                            <CheckCheck size={14} /> Mark all read
                        </button>
                    )}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-sm transition-colors ${showFilters ? 'bg-ac-taupe/10 text-ac-taupe' : 'text-ac-taupe/40 hover:text-ac-gold'}`}
                    >
                        <Filter size={18} />
                    </button>
                    <button
                        onClick={loadNotifications}
                        className="p-2 text-ac-taupe/40 hover:text-ac-gold transition-colors"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="mb-4 flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1 text-xs rounded-sm transition-colors ${filter === 'all' ? 'bg-ac-taupe text-white' : 'bg-ac-taupe/10 text-ac-taupe hover:bg-ac-taupe/20'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-3 py-1 text-xs rounded-sm transition-colors ${filter === 'unread' ? 'bg-ac-taupe text-white' : 'bg-ac-taupe/10 text-ac-taupe hover:bg-ac-taupe/20'}`}
                    >
                        Unread Only
                    </button>
                </div>
            )}

            {/* Empty State */}
            {notifications.length === 0 && (
                <div className="p-16 text-center border-2 border-dashed border-ac-taupe/10 rounded-sm">
                    <div className="inline-block p-4 bg-ac-olive/10 rounded-full mb-4 text-ac-olive">
                        <Bell size={32} />
                    </div>
                    <h3 className="font-serif text-2xl text-ac-taupe mb-2">All caught up!</h3>
                    <p className="text-ac-taupe/60">No notifications to display.</p>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                <AnimatePresence>
                    {notifications.map((notification) => (
                        <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onMarkRead={handleMarkRead}
                            onTakeAction={handleTakeAction}
                            isProcessing={processingId === notification.id}
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
    isProcessing
}: {
    notification: AdminNotification;
    onMarkRead: (id: string) => void;
    onTakeAction: (id: string, action: string) => void;
    isProcessing: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const isUnread = notification.status === 'unread';
    const isActioned = notification.status === 'actioned';

    const metadata = notification.metadata || {};

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
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
                    if (isUnread) onMarkRead(notification.id);
                }}
            >
                <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`p-2 rounded-full ${typeColors[notification.type] || typeColors['general']}`}>
                        {typeIcons[notification.type] || typeIcons['general']}
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
                            <div className="flex items-center gap-1">
                                <DollarSign size={12} /> {metadata.amount} {metadata.currency || 'USD'}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {!isActioned && notification.type === 'service_booking' && (
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onTakeAction(notification.id, 'scheduled'); }}
                                className="flex-1 py-2 bg-ac-taupe text-white text-xs uppercase tracking-widest rounded-sm hover:bg-ac-gold transition-colors"
                            >
                                Mark Scheduled
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onTakeAction(notification.id, 'completed'); }}
                                className="flex-1 py-2 bg-ac-olive/10 text-ac-olive text-xs uppercase tracking-widest rounded-sm hover:bg-ac-olive hover:text-white transition-colors"
                            >
                                Mark Completed
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}
