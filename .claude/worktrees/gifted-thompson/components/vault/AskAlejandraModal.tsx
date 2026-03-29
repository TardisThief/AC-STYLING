"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, Sparkles } from "lucide-react";
import { askQuestion } from "@/app/actions/send-question";

interface AskAlejandraModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AskAlejandraModal({ isOpen, onClose }: AskAlejandraModalProps) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus('sending');

        const formData = new FormData(e.currentTarget);
        const result = await askQuestion(formData);

        if (result.success) {
            setStatus('sent');
            setTimeout(() => {
                onClose();
                setTimeout(() => setStatus('idle'), 500); // Reset after close
            }, 2000);
        } else {
            setStatus('error');
            setErrorMessage(result.error || "Something went wrong.");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-lg bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl rounded-sm p-8 md:p-10 pointer-events-auto relative overflow-hidden"
                        >
                            {/* Glass Reflection */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                            >
                                <X size={24} />
                            </button>

                            {status === 'sent' ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                        className="w-16 h-16 bg-ac-olive rounded-full flex items-center justify-center text-ac-gold shadow-lg"
                                    >
                                        <CheckCircle2 size={32} />
                                    </motion.div>
                                    <h3 className="font-serif text-2xl text-ac-taupe">Message Sent</h3>
                                    <p className="text-ac-taupe/60 text-sm">Alejandra will review your question shortly.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-8 text-center">
                                        <div className="flex justify-center mb-4">
                                            <Sparkles className="text-ac-gold" size={24} />
                                        </div>
                                        <h2 className="font-serif text-3xl text-ac-taupe mb-2">Ask Ale a Question</h2>
                                        <p className="text-ac-taupe/60 text-sm">
                                            Ask a question about your distillation journey or personal style.
                                        </p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="question" className="sr-only">Your Question</label>
                                            <textarea
                                                name="question"
                                                id="question"
                                                rows={4}
                                                required
                                                placeholder="How do I balance my capsule if I love both structure and flow?"
                                                className="w-full bg-white/40 border border-ac-taupe/10 rounded-sm p-4 text-ac-taupe placeholder:text-ac-taupe/30 focus:outline-none focus:border-ac-gold focus:ring-1 focus:ring-ac-gold transition-all resize-none font-serif text-lg leading-relaxed shadow-inner"
                                            />
                                        </div>

                                        {status === 'error' && (
                                            <p className="text-red-500 text-xs text-center">{errorMessage}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={status === 'sending'}
                                            className="w-full bg-ac-taupe text-white py-4 px-6 rounded-sm hover:bg-ac-taupe/90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 group"
                                        >
                                            {status === 'sending' ? (
                                                <span className="animate-pulse">Sending...</span>
                                            ) : (
                                                <>
                                                    <span className="font-serif tracking-wide">Send to Alejandra</span>
                                                    <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
