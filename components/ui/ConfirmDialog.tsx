"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";

interface ConfirmDialogProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    /** What will happen, in plain language. Name the object and the consequence. */
    body: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Irreversible actions get the red treatment and a stronger label. */
    destructive?: boolean;
}

/**
 * Replaces native `confirm()`. The browser dialog is unstyled, unbrandable and
 * thread-blocking — a luxury product should not break character at the exact
 * moment it asks for trust. This also keeps confirmation keyboard-accessible
 * and consistent with the rest of the Studio's vocabulary.
 */
export default function ConfirmDialog({
    isOpen,
    onCancel,
    onConfirm,
    title,
    body,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
}: ConfirmDialogProps) {
    const [isWorking, setIsWorking] = useState(false);

    const handleConfirm = useCallback(async () => {
        setIsWorking(true);
        try {
            await onConfirm();
        } finally {
            setIsWorking(false);
        }
    }, [onConfirm]);

    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} widthClass="max-w-sm">
            <div className="px-8 pt-4 pb-8 space-y-6">
                <div className="text-sm text-ac-taupe/70 leading-relaxed">{body}</div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-sm border border-ac-taupe/20 text-ac-taupe/70 text-[10px] font-bold uppercase tracking-widest hover:border-ac-taupe/40 hover:text-ac-taupe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-gold transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isWorking}
                        className={`flex-1 py-3 rounded-sm text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all ${destructive
                            ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-700"
                            : "bg-ac-taupe hover:bg-ac-gold focus-visible:ring-ac-gold"
                            }`}
                    >
                        {isWorking && <Loader2 className="animate-spin" size={14} aria-hidden="true" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
