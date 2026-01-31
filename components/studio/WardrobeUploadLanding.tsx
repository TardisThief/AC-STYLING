"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Check, Loader2, Camera, Sparkles, X, LogIn, ChevronRight, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { uploadToWardrobe } from "@/app/actions/wardrobes";
import type { Wardrobe } from "@/app/actions/wardrobes";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
    wardrobe: Wardrobe;
    token: string;
    locale: string;
}

interface StagedFile {
    file: File;
    preview: string;
    category: string;
    note: string;
}

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Bags'];

export default function WardrobeUploadLanding({ wardrobe, token, locale }: Props) {
    const router = useRouter();
    const supabase = createClient();

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [authRequired, setAuthRequired] = useState(false);

    // Upload state
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Thank you modal
    const [showThankYou, setShowThankYou] = useState(false);

    // Check auth and determine flow
    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setIsAuthenticated(true);

                // Check if admin
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                // For owned wardrobes, check if user is owner or admin
                if (wardrobe.owner_id && wardrobe.owner_id !== user.id && profile?.role !== 'admin') {
                    setAuthRequired(true); // Wrong user
                }
            } else {
                setIsAuthenticated(false);
                // If wardrobe has owner, require auth
                if (wardrobe.owner_id) {
                    setAuthRequired(true);
                }
            }
        }
        checkAuth();
    }, [supabase, wardrobe.owner_id]);

    // File input refs
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Handle file selection from any source
    const handleFilesSelected = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newStaged = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            category: 'Tops',
            note: ''
        }));
        setStagedFiles(prev => [...prev, ...newStaged]);
    }, []);

    // Camera input handler
    const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFilesSelected(e.target.files);
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    // Gallery input handler
    const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFilesSelected(e.target.files);
        // Reset input so same files can be selected again
        e.target.value = '';
    };

    // Remove staged file
    const removeStaged = (index: number) => {
        setStagedFiles(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].preview);
            updated.splice(index, 1);
            return updated;
        });
    };

    // Update staged file metadata
    const updateStaged = (index: number, updates: Partial<StagedFile>) => {
        setStagedFiles(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...updates };
            return updated;
        });
    };

    // Upload all staged files
    const handleUploadAll = async () => {
        if (stagedFiles.length === 0) return;

        setIsUploading(true);
        let successCount = 0;

        for (const staged of stagedFiles) {
            try {
                const formData = new FormData();
                formData.append('file', staged.file);
                formData.append('note', staged.note);
                formData.append('category', staged.category);

                const result = await uploadToWardrobe(formData, token);

                if (result.success) {
                    successCount++;
                } else {
                    toast.error(`Failed to upload ${staged.file.name}`);
                }
            } catch (err) {
                toast.error(`Error uploading ${staged.file.name}`);
            }
        }

        if (successCount > 0) {
            setUploadedCount(prev => prev + successCount);
            toast.success(`${successCount} item(s) uploaded successfully!`);
            // Clear staged files
            stagedFiles.forEach(s => URL.revokeObjectURL(s.preview));
            setStagedFiles([]);
        }

        setIsUploading(false);
    };

    // Handle "I'm Done"
    const handleDone = () => {
        if (!wardrobe.owner_id) {
            // New invite - show thank you modal
            setShowThankYou(true);
        } else {
            // Existing wardrobe - go to vault
            router.push(`/${locale}/vault`);
        }
    };

    // Redirect to signup/login with return URL
    const currentPath = `/${locale}/studio/upload/${token}`;

    const handleCreateAccount = () => {
        router.push(`/${locale}/signup?wardrobe=${token}&next=${encodeURIComponent(currentPath)}`);
    };

    const handleLogin = () => {
        router.push(`/${locale}/login?wardrobe=${token}&next=${encodeURIComponent(currentPath)}`);
    };

    // Loading state
    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-ac-gold animate-spin" />
            </div>
        );
    }

    // Auth required but not authenticated or wrong user
    if (authRequired) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full mx-auto bg-white rounded-sm shadow-2xl overflow-hidden p-8 text-center"
            >
                <LogIn className="w-12 h-12 mx-auto mb-4 text-ac-taupe/40" />
                <h1 className="font-serif text-2xl text-ac-taupe mb-2">
                    {locale === 'es' ? 'Acceso Requerido' : 'Login Required'}
                </h1>
                <p className="text-sm text-ac-taupe/60 mb-6">
                    {locale === 'es'
                        ? 'Este armario pertenece a un usuario registrado. Inicia sesión para subir fotos.'
                        : 'This wardrobe belongs to a registered user. Please log in to upload photos.'}
                </p>
                <button
                    onClick={handleLogin}
                    className="w-full bg-ac-taupe text-white py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all"
                >
                    {locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                </button>
            </motion.div>
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl w-full mx-auto bg-white rounded-sm shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-ac-taupe to-ac-olive p-6 md:p-8 text-white text-center">
                    <Sparkles className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-3 opacity-80" />
                    <h1 className="font-serif text-2xl md:text-3xl mb-2">
                        {locale === 'es' ? 'Bienvenida a tu Armario' : 'Welcome to Your Wardrobe'}
                    </h1>
                    <p className="opacity-70 text-sm">
                        {wardrobe.title}
                    </p>
                </div>

                {/* Content */}
                <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                    {/* Instructions */}
                    <div className="bg-ac-gold/10 border border-ac-gold/20 p-3 md:p-4 rounded-sm text-center">
                        <p className="text-xs md:text-sm text-ac-taupe">
                            {locale === 'es'
                                ? 'Sube fotos de tus prendas. Las revisaremos y organizaremos para ti.'
                                : 'Upload photos of your clothing items. We\'ll review and organize them for you.'}
                        </p>
                    </div>

                    {/* Upload Buttons */}
                    <div className={`space-y-3 ${isUploading || authRequired ? 'opacity-50 pointer-events-none' : ''}`}>
                        {/* Hidden file inputs */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleCameraChange}
                            className="hidden"
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleGalleryChange}
                            className="hidden"
                        />

                        {/* Two-button layout */}
                        <div className="flex gap-3">
                            {/* Take Photo Button */}
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center justify-center gap-2 bg-ac-taupe text-white py-4 px-4 rounded-sm hover:bg-ac-gold transition-all"
                            >
                                <Camera className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                    {locale === 'es' ? 'Tomar Foto' : 'Take Photo'}
                                </span>
                            </button>

                            {/* Upload from Gallery Button */}
                            <button
                                type="button"
                                onClick={() => galleryInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-ac-taupe/20 text-ac-taupe py-4 px-4 rounded-sm hover:border-ac-gold hover:text-ac-gold transition-all"
                            >
                                <ImagePlus className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                    {locale === 'es' ? 'Galería' : 'Gallery'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Staged Files Preview */}
                    <AnimatePresence>
                        {stagedFiles.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40">
                                        {locale === 'es' ? 'Preparados para subir' : 'Ready to upload'} ({stagedFiles.length})
                                    </p>
                                    <button
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="text-[10px] font-bold uppercase tracking-widest text-ac-gold hover:text-ac-taupe transition-colors"
                                    >
                                        {locale === 'es' ? '+ Añadir más' : '+ Add more'}
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {stagedFiles.map((staged, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="bg-ac-taupe/5 rounded-sm p-3 flex gap-3"
                                        >
                                            {/* Thumbnail */}
                                            <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-sm overflow-hidden bg-white">
                                                <img
                                                    src={staged.preview}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Metadata */}
                                            <div className="flex-1 min-w-0 space-y-2">
                                                {/* Category chips */}
                                                <div className="flex flex-wrap gap-1">
                                                    {CATEGORIES.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => updateStaged(index, { category: cat })}
                                                            className={`px-2 py-0.5 rounded-sm text-[9px] md:text-[10px] uppercase font-bold tracking-tighter border transition-all ${staged.category === cat
                                                                ? 'bg-ac-taupe text-white border-ac-taupe'
                                                                : 'border-ac-taupe/10 text-ac-taupe/60 hover:border-ac-taupe/30'
                                                                }`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Note input */}
                                                <input
                                                    type="text"
                                                    value={staged.note}
                                                    onChange={(e) => updateStaged(index, { note: e.target.value })}
                                                    placeholder={locale === 'es' ? 'Nota (opcional)...' : 'Note (optional)...'}
                                                    className="w-full bg-white border border-ac-taupe/10 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-ac-gold"
                                                />
                                            </div>

                                            {/* Remove button */}
                                            <button
                                                onClick={() => removeStaged(index)}
                                                className="text-ac-taupe/30 hover:text-red-500 transition-colors self-start"
                                            >
                                                <X size={16} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Upload Button */}
                                <button
                                    onClick={handleUploadAll}
                                    disabled={isUploading}
                                    className="w-full bg-ac-gold text-white py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-taupe transition-all flex items-center justify-center gap-2"
                                >
                                    {isUploading ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            <span>{locale === 'es' ? 'Subir Todo' : 'Upload All'}</span>
                                            <ChevronRight size={14} />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Upload Counter & Done Button */}
                    <AnimatePresence>
                        {uploadedCount > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3"
                            >
                                <div className="bg-ac-olive/10 border border-ac-olive/20 p-3 md:p-4 rounded-sm flex items-center justify-center gap-3">
                                    <Check className="text-ac-olive" size={20} />
                                    <span className="text-sm text-ac-taupe font-medium">
                                        {uploadedCount} {locale === 'es' ? 'artículos subidos' : 'items uploaded'}
                                    </span>
                                </div>

                                {/* I'm Done Button */}
                                <button
                                    onClick={handleDone}
                                    className="w-full bg-ac-taupe text-white py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all"
                                >
                                    {locale === 'es' ? 'Terminé de Subir' : "I'm Done Uploading"}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CTA: Login option for unclaimed wardrobes */}
                    {!wardrobe.owner_id && uploadedCount === 0 && (
                        <div className="pt-4 border-t border-ac-taupe/10 text-center">
                            <p className="text-xs text-ac-taupe/40 mb-3 uppercase tracking-widest">
                                {locale === 'es' ? '¿Ya tienes cuenta?' : 'Already have an account?'}
                            </p>
                            <button
                                onClick={handleLogin}
                                className="inline-flex items-center gap-2 border border-ac-taupe/20 text-ac-taupe px-6 py-2 rounded-sm font-bold uppercase tracking-widest text-xs hover:border-ac-gold hover:text-ac-gold transition-all"
                            >
                                <LogIn size={14} />
                                {locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Thank You Modal */}
            <AnimatePresence>
                {showThankYou && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-md bg-white rounded-sm shadow-xl p-6 md:p-8 z-10 text-center"
                        >
                            <Sparkles className="w-12 h-12 mx-auto mb-4 text-ac-gold" />
                            <h2 className="font-serif text-2xl text-ac-taupe mb-2">
                                {locale === 'es' ? '¡Gracias!' : 'Thank You!'}
                            </h2>
                            <p className="text-sm text-ac-taupe/70 mb-6">
                                {locale === 'es'
                                    ? 'Gracias por confiar en Ale con tu armario. Crearemos tu perfil de estilo personalizado.'
                                    : "Thanks for trusting Ale with your wardrobe! We'll create your personalized style profile."}
                            </p>

                            <div className="bg-ac-gold/10 border border-ac-gold/20 p-4 rounded-sm mb-6">
                                <p className="text-xs text-ac-taupe">
                                    {locale === 'es'
                                        ? 'Crea una cuenta para guardar tu armario y acceder a él en cualquier momento.'
                                        : 'Create an account to save your wardrobe and access it anytime.'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleCreateAccount}
                                    className="w-full bg-ac-taupe text-white py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all"
                                >
                                    {locale === 'es' ? 'Crear Cuenta' : 'Create Account'}
                                </button>
                                <button
                                    onClick={handleLogin}
                                    className="w-full border border-ac-taupe/20 text-ac-taupe py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:border-ac-gold hover:text-ac-gold transition-all"
                                >
                                    {locale === 'es' ? 'Ya tengo cuenta' : 'I Already Have an Account'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
