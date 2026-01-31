"use client";

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUnreadAnswers, markAnswerAsRead } from '@/app/actions/send-question';
import { createClient } from '@/utils/supabase/client';


export default function UserNotifications() {
    const [unreadQuestions, setUnreadQuestions] = useState<any[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        checkNotifications();
        // Poll every 60s
        const interval = setInterval(checkNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    const checkNotifications = async () => {
        const res = await getUnreadAnswers();
        if (res.success && res.questions) {
            setUnreadQuestions(res.questions);
        }
    };

    const handleOpen = () => {
        if (unreadQuestions.length > 0) {
            setSelectedQuestion(unreadQuestions[0]); // Show latest
            setIsOpen(true);
        }
    };

    const handleClose = async () => {
        setIsOpen(false);
        if (selectedQuestion) {
            await markAnswerAsRead(selectedQuestion.id);
            setUnreadQuestions(prev => prev.filter(q => q.id !== selectedQuestion.id));
            setSelectedQuestion(null);
        }
    };

    if (unreadQuestions.length === 0) return null;

    return (
        <>
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                onClick={handleOpen}
                className="relative p-2 text-ac-taupe/80 hover:text-ac-gold transition-colors"
                title="New Reply"
            >
                <Bell size={20} className="fill-ac-gold text-ac-gold animate-pulse" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-md bg-[#faf9f6] border border-ac-gold/20 rounded-sm shadow-xl p-6 z-10"
                        >
                            <h2 className="font-serif text-2xl text-ac-taupe mb-2">Alejandra Replied</h2>
                            <p className="text-ac-taupe/60 text-sm mb-4">
                                Your styling question has been answered.
                            </p>

                            {selectedQuestion && (
                                <div className="space-y-4">
                                    <div className="bg-white/50 p-3 rounded-sm border-l-2 border-ac-taupe/20">
                                        <p className="text-xs text-ac-taupe/60 uppercase tracking-wider mb-1">You asked:</p>
                                        <p className="text-ac-taupe italic">"{selectedQuestion.question}"</p>
                                    </div>

                                    <div className="bg-ac-gold/5 p-4 rounded-sm border border-ac-gold/20">
                                        <p className="text-xs text-ac-gold uppercase tracking-wider mb-2 font-bold">Alejandra says:</p>
                                        <p className="text-ac-taupe leading-relaxed whitespace-pre-line">{selectedQuestion.answer}</p>
                                    </div>

                                    <button
                                        onClick={handleClose}
                                        className="w-full py-2 bg-ac-taupe text-white text-sm uppercase tracking-widest rounded-sm hover:bg-ac-gold transition-colors"
                                    >
                                        Close & Mark as Read
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
