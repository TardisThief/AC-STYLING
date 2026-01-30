"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Check, Loader2, Camera, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { uploadToWardrobe } from "@/app/actions/wardrobes";
import type { Wardrobe } from "@/app/actions/wardrobes";

interface Props {
    wardrobe: Wardrobe;
    token: string;
    locale: string;
}

export default function WardrobeUploadLanding({ wardrobe, token, locale }: Props) {
    const [uploadedCount, setUploadedCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [note, setNote] = useState("");

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setIsUploading(true);
        let successCount = 0;

        for (const file of acceptedFiles) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('note', note);

                const result = await uploadToWardrobe(formData, token);

                if (result.success) {
                    successCount++;
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                toast.error(`Error uploading ${file.name}`);
            }
        }

        if (successCount > 0) {
            setUploadedCount(prev => prev + successCount);
            toast.success(`${successCount} item(s) uploaded successfully!`);
            setNote(""); // Clear note after upload
        }

        setIsUploading(false);
    }, [token, note]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic']
        },
        disabled: isUploading
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full mx-auto bg-white rounded-sm shadow-2xl overflow-hidden"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-ac-taupe to-ac-olive p-8 text-white text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-80" />
                <h1 className="font-serif text-3xl mb-2">
                    {locale === 'es' ? 'Bienvenida a tu Armario' : 'Welcome to Your Wardrobe'}
                </h1>
                <p className="opacity-70 text-sm">
                    {wardrobe.title}
                </p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
                {/* Instructions */}
                <div className="bg-ac-gold/10 border border-ac-gold/20 p-4 rounded-sm text-center">
                    <p className="text-sm text-ac-taupe">
                        {locale === 'es'
                            ? 'Sube fotos de tus prendas. Las revisaremos y organizaremos para ti.'
                            : 'Upload photos of your clothing items. We\'ll review and organize them for you.'}
                    </p>
                </div>

                {/* Optional Note */}
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">
                        {locale === 'es' ? 'Nota (Opcional)' : 'Note (Optional)'}
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={locale === 'es' ? 'Añade contexto sobre estas prendas...' : 'Add context about these items...'}
                        className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-ac-gold transition-all resize-none h-20"
                    />
                </div>

                {/* Upload Zone */}
                <div
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-sm p-12 text-center cursor-pointer transition-all
                        ${isDragActive ? 'border-ac-gold bg-ac-gold/10' : 'border-ac-taupe/20 hover:border-ac-gold/50 hover:bg-ac-taupe/5'}
                        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                >
                    <input {...getInputProps()} />
                    <div className="w-16 h-16 bg-ac-taupe/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        {isUploading ? (
                            <Loader2 className="w-8 h-8 text-ac-gold animate-spin" />
                        ) : (
                            <Camera className="w-8 h-8 text-ac-taupe/40" />
                        )}
                    </div>
                    <p className="font-serif text-xl text-ac-taupe mb-2">
                        {isDragActive
                            ? (locale === 'es' ? 'Suelta aquí' : 'Drop here')
                            : (locale === 'es' ? 'Arrastra fotos aquí' : 'Drag photos here')}
                    </p>
                    <p className="text-sm text-ac-taupe/60">
                        {locale === 'es' ? 'o haz clic para seleccionar' : 'or click to select'}
                    </p>
                </div>

                {/* Upload Counter */}
                <AnimatePresence>
                    {uploadedCount > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-ac-olive/10 border border-ac-olive/20 p-4 rounded-sm flex items-center justify-center gap-3"
                        >
                            <Check className="text-ac-olive" size={20} />
                            <span className="text-sm text-ac-taupe font-medium">
                                {uploadedCount} {locale === 'es' ? 'artículos subidos' : 'items uploaded'}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CTA: Create Account */}
                <div className="pt-4 border-t border-ac-taupe/10 text-center">
                    <p className="text-xs text-ac-taupe/40 mb-3 uppercase tracking-widest">
                        {locale === 'es' ? '¿Quieres acceso completo?' : 'Want full access?'}
                    </p>
                    <a
                        href={`/${locale}/signup?wardrobe=${wardrobe.id}`}
                        className="inline-flex items-center gap-2 bg-ac-taupe text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all"
                    >
                        {locale === 'es' ? 'Crear Cuenta' : 'Create Account'}
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
