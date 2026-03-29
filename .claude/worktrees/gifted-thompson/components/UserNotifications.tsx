"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getUnreadAnswers, markAnswerAsRead } from "@/app/actions/send-question";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function UserNotifications() {
    const [unreadQuestions, setUnreadQuestions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const fetchNotifications = async () => {
        const res = await getUnreadAnswers();
        if (res.success) {
            setUnreadQuestions(res.questions || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        // Optional: Poll every 60s
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDismiss = async (id: string) => {
        // Optimistic update
        setUnreadQuestions(prev => prev.filter(q => q.id !== id));

        const res = await markAnswerAsRead(id);
        if (!res.success) {
            toast.error("Failed to mark as read");
            fetchNotifications(); // Revert on failure
        } else {
            router.refresh(); // Refresh in case it affects other UI
        }
    };

    if (loading && !unreadQuestions.length) return null; // Don't show anything while initial loading if empty logic desired, or show bell without badge

    const hasUnread = unreadQuestions.length > 0;

    return (
        <div className="relative z-50" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-ac-taupe/60 hover:text-ac-gold transition-colors"
            >
                <Bell size={20} />
                {hasUnread && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-80 md:w-96 bg-white shadow-xl rounded-sm border border-ac-gold/20 overflow-hidden text-left"
                    >
                        <div className="p-3 bg-ac-taupe/5 border-b border-ac-taupe/10 flex justify-between items-center">
                            <span className="text-xs font-serif font-bold uppercase tracking-widest text-ac-taupe">
                                Notifications
                            </span>
                            <button onClick={() => setIsOpen(false)} className="text-ac-taupe/40 hover:text-ac-taupe">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {unreadQuestions.length === 0 ? (
                                <div className="p-8 text-center text-ac-taupe/40 text-sm">
                                    No new notifications.
                                </div>
                            ) : (
                                <div>
                                    {unreadQuestions.map((q) => (
                                        <div key={q.id} className="p-4 border-b border-ac-taupe/5 hover:bg-ac-gold/5 transition-colors relative group">
                                            <p className="text-xs text-ac-taupe/60 italic mb-2 line-clamp-1">"{q.question}"</p>
                                            <div className="text-sm text-ac-taupe mb-3">
                                                <span className="font-semibold text-ac-gold text-xs uppercase tracking-wider block mb-1">Answer:</span>
                                                {q.answer}
                                            </div>
                                            <button
                                                onClick={() => handleDismiss(q.id)}
                                                className="w-full py-1.5 flex items-center justify-center gap-2 bg-white border border-ac-taupe/10 text-xs text-ac-taupe/60 hover:text-ac-gold hover:border-ac-gold/30 transition-colors uppercase tracking-wider rounded-sm"
                                            >
                                                <Check size={12} /> Mark as Read
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
