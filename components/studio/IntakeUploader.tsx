"use client";

import { useState, useRef } from "react";
import { Upload, X, Plus, Check, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface FileEntry {
    file: File;
    preview: string;
    note: string;
    status: 'idle' | 'uploading' | 'success' | 'error';
    id?: string;
}

import { uploadGuestWardrobeItem } from "@/app/actions/studio";

interface IntakeUploaderProps {
    token: string;
    isGuest: boolean;
    locale: string;
    onUploadSuccess?: () => void;
}

export default function IntakeUploader({ token, isGuest, locale, onUploadSuccess }: IntakeUploaderProps) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const newFiles = Array.from(e.target.files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            note: "",
            status: 'idle' as const
        }));

        setFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setFiles(prev => {
            const newFiles = [...prev];
            URL.revokeObjectURL(newFiles[index].preview);
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const updateNote = (index: number, note: string) => {
        setFiles(prev => {
            const newFiles = [...prev];
            newFiles[index].note = note;
            return newFiles;
        });
    };

    const handleUploadAll = async () => {
        setIsProcessing(true);

        try {
            // Check if Guest or Auth
            if (isGuest) {
                console.log("Starting Guest Upload with Token:", token);

                for (let i = 0; i < files.length; i++) {
                    const entry = files[i];
                    if (entry.status === 'success') continue;

                    setFiles(prev => {
                        const next = [...prev];
                        next[i].status = 'uploading';
                        return next;
                    });

                    // Use Server Action
                    const formData = new FormData();
                    formData.append('file', entry.file);
                    formData.append('note', entry.note);

                    const result = await uploadGuestWardrobeItem(formData, token);

                    if (!result.success) {
                        throw new Error(result.error);
                    }

                    setFiles(prev => {
                        const next = [...prev];
                        next[i].status = 'success';
                        return next;
                    });
                }

                toast.success("Photos uploaded successfully.");
                // Trigger callback to move to Signup/Login
                if (onUploadSuccess) onUploadSuccess();

            } else {
                // AUTHENTICATED UPLOAD
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) throw new Error("Authentication failed");

                for (let i = 0; i < files.length; i++) {
                    const entry = files[i];
                    if (entry.status === 'success') continue;

                    setFiles(prev => {
                        const next = [...prev];
                        next[i].status = 'uploading';
                        return next;
                    });

                    const fileExt = entry.file.name.split('.').pop();
                    const fileName = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const filePath = `wardrobe/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('studio-wardrobe')
                        .upload(filePath, entry.file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('studio-wardrobe')
                        .getPublicUrl(filePath);

                    const { error: dbError } = await supabase
                        .from('wardrobe_items')
                        .insert({
                            user_id: user.id,
                            image_url: publicUrl,
                            client_note: entry.note,
                            status: 'Keep'
                        });

                    if (dbError) throw dbError;

                    setFiles(prev => {
                        const next = [...prev];
                        next[i].status = 'success';
                        return next;
                    });
                }

                setIsComplete(true);
                toast.success("Successfully uploaded your style assets!");
            }

        } catch (error: any) {
            console.error("Upload Error:", error);
            toast.error(`Upload Failed: ${error.message || "Unknown error"}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isComplete) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/30 backdrop-blur-xl border border-white/40 p-8 rounded-sm shadow-2xl text-center"
            >
                <div className="inline-block p-4 bg-ac-olive/10 rounded-full mb-6 text-ac-olive">
                    <Check size={40} />
                </div>
                <h2 className="font-serif text-3xl text-ac-taupe mb-4">Intake Received</h2>
                <p className="text-ac-taupe/70 mb-8 font-sans">
                    Alejandra has been notified. While she reviews your assets, we invite you to explore the foundations of your transformation.
                </p>

                <div className="bg-white/40 border border-ac-gold/20 p-6 rounded-sm text-center">
                    <h3 className="font-serif text-xl text-ac-taupe mb-4 flex items-center justify-center gap-2">
                        <Sparkles size={18} className="text-ac-gold" />
                        A Gift of Discovery
                    </h3>
                    <p className="text-xs text-ac-taupe/60 mb-6 max-w-xs mx-auto">
                        Begin your journey by exploring our Masterclass collections, where the language of style comes to life.
                    </p>
                    <a
                        href={`/${locale}/vault/gallery`}
                        className="block w-full bg-ac-taupe text-center text-white py-4 px-6 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all"
                    >
                        Explore the Collections
                    </a>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/30 backdrop-blur-xl border border-white/40 p-6 rounded-sm shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-2xl text-ac-taupe">Upload Wardrobe</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 bg-white/40 px-3 py-1 rounded-full">
                            {files.length} Items Selected
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                    <AnimatePresence>
                        {files.map((entry, index) => (
                            <motion.div
                                key={entry.preview}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="aspect-[3/4] relative group"
                            >
                                <img
                                    src={entry.preview}
                                    className="w-full h-full object-cover rounded-sm border border-white/50"
                                    alt="Preview"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-2 space-y-1">
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="absolute -top-2 -right-2 bg-white text-red-500 p-1 rounded-full shadow-lg"
                                    >
                                        <X size={12} />
                                    </button>
                                    <textarea
                                        value={entry.note}
                                        onChange={(e) => updateNote(index, e.target.value)}
                                        placeholder="Add a note..."
                                        className="w-full h-full bg-white/20 backdrop-blur-sm border border-white/30 rounded-sm p-2 text-[10px] text-white placeholder:text-white/60 focus:outline-none focus:bg-white/40 transition-all resize-none"
                                    />
                                </div>
                                {entry.status === 'uploading' && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="text-ac-gold animate-spin" size={24} />
                                    </div>
                                )}
                                {entry.status === 'success' && (
                                    <div className="absolute top-2 right-2 bg-ac-olive text-white p-1 rounded-full">
                                        <Check size={12} />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[3/4] border-2 border-dashed border-ac-taupe/20 rounded-sm flex flex-col items-center justify-center text-ac-taupe/40 hover:border-ac-gold/40 hover:text-ac-gold transition-all bg-white/10"
                    >
                        <Plus size={32} strokeWidth={1} />
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-2">{files.length === 0 ? "Add Photos" : "Add More"}</span>
                    </button>
                </div>

                <input
                    type="file"
                    multiple
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />

                <button
                    onClick={handleUploadAll}
                    disabled={files.length === 0 || isProcessing}
                    className="w-full disabled:opacity-50 bg-ac-taupe text-white py-5 px-8 rounded-sm flex items-center justify-center gap-3 hover:bg-ac-taupe/90 transition-all font-sans font-bold uppercase tracking-widest text-sm"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            {isGuest ? "Uploading Securely..." : "Processing..."}
                        </>
                    ) : (
                        <>
                            <Upload size={20} />
                            {isGuest ? "Send Intake & Secure Vault" : "Complete Intake"}
                        </>
                    )}
                </button>
            </div>

            <div className="flex items-center gap-4 px-4 py-2 bg-ac-taupe/5 rounded-full w-fit mx-auto">
                <ImageIcon size={14} className="text-ac-taupe/40" />
                <p className="text-[10px] text-ac-taupe/40 font-bold uppercase tracking-widest">
                    Optimization enabled for mobile camera
                </p>
            </div>
        </div>
    );
}
