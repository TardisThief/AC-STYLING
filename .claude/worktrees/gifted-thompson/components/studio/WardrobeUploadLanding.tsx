"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Check, Loader2, Camera, Sparkles, X, LogIn, ChevronRight, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getSignedUploadUrl, createWardrobeItem, claimWardrobe } from "@/app/actions/wardrobes";
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

    // Welcome screen (shown after claiming wardrobe)
    const [showWelcome, setShowWelcome] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

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
                } else if (!wardrobe.owner_id) {
                    // Unclaimed wardrobe OR just claimed by auth callback
                    // (wardrobe.owner_id is from server-side props, might be stale after redirect)
                    setIsClaiming(true);
                    try {
                        const result = await claimWardrobe(token);
                        if (result.success) {
                            // Show welcome regardless - it's a new visit after signup/login
                            setShowWelcome(true);
                            toast.success(locale === 'es' ? '¡Bienvenida al AC Styling Studio!' : 'Welcome to the AC Styling Studio!');
                        } else {
                            // Only show error if it's not an "already owned" situation
                            console.warn('Claim result:', result.error);
                            // Still show the uploader since claim may have happened in callback
                            setShowWelcome(true);
                        }
                    } catch (err) {
                        console.error('Claim error:', err);
                        // Still proceed to welcome - wardrobe might have been claimed
                        setShowWelcome(true);
                    } finally {
                        setIsClaiming(false);
                    }
                } else if (wardrobe.owner_id === user.id) {
                    // Already owned by this user - verify studio access (in case it was missed)
                    claimWardrobe(token); // This will ensure active_studio_client is set
                }
            } else {
                setIsAuthenticated(false);
                // Auth required for ALL wardrobes (no guest uploads)
                setAuthRequired(true);
            }
        }
        checkAuth();
    }, [supabase, wardrobe.owner_id, token, locale]);

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

    // Upload all staged files using direct upload to Supabase (bypasses Vercel limits)
    const handleUploadAll = async () => {
        if (stagedFiles.length === 0) return;

        setIsUploading(true);
        let successCount = 0;

        for (const staged of stagedFiles) {
            try {
                // Step 1: Get signed upload URL from server
                const urlResult = await getSignedUploadUrl(token, staged.file.name);

                if (!urlResult.success || !urlResult.signedUrl || !urlResult.filePath) {
                    toast.error(`Failed to prepare upload for ${staged.file.name}`);
                    continue;
                }

                // Step 2: Upload directly to Supabase Storage (bypasses Vercel)
                const uploadResponse = await fetch(urlResult.signedUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': staged.file.type || 'image/jpeg',
                    },
                    body: staged.file,
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Storage upload failed: ${uploadResponse.status}`);
                }

                // Step 3: Create database record
                const dbResult = await createWardrobeItem(
                    token,
                    urlResult.filePath,
                    staged.category,
                    staged.note
                );

                if (dbResult.success) {
                    successCount++;
                } else {
                    toast.error(`Failed to save ${staged.file.name}`);
                }
            } catch (err: any) {
                console.error('Upload error:', err);
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

    // Handle "I'm Done" - always go to vault since wardrobe is now owned
    const handleDone = () => {
        router.push(`/${locale}/vault`);
    };

    // Dismiss welcome screen
    const handleDismissWelcome = () => {
        setShowWelcome(false);
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
                <div className="inline-block p-4 bg-ac-gold/10 rounded-full mb-6">
                    <Sparkles className="w-8 h-8 text-ac-gold" />
                </div>
                <h1 className="font-serif text-2xl text-ac-taupe mb-2">
                    {locale === 'es' ? 'Bienvenida al AC Styling Studio' : 'Welcome to AC Styling Studio'}
                </h1>
                <p className="text-sm text-ac-taupe/60 mb-8">
                    {locale === 'es'
                        ? 'Para subir tu armario, por favor crea una cuenta o inicia sesión.'
                        : 'To upload your wardrobe, please create an account or sign in.'}
                </p>
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
        );
    }

    // Claiming wardrobe in progress
    if (isClaiming) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Loader2 className="w-10 h-10 text-ac-gold animate-spin mb-4" />
                <p className="text-ac-taupe/60 text-sm uppercase tracking-widest">
                    {locale === 'es' ? 'Configurando tu armario...' : 'Setting up your wardrobe...'}
                </p>
            </div>
        );
    }

    // Welcome screen after claiming
    if (showWelcome) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full mx-auto bg-white rounded-sm shadow-2xl overflow-hidden p-8 text-center"
            >
                <div className="inline-block p-4 bg-ac-gold/10 rounded-full mb-6">
                    <Sparkles className="w-10 h-10 text-ac-gold" />
                </div>
                <h1 className="font-serif text-3xl text-ac-taupe mb-3">
                    {locale === 'es' ? '¡Bienvenida al AC Styling Studio!' : 'Welcome to the AC Styling Studio!'}
                </h1>
                <p className="text-sm text-ac-taupe/60 mb-8">
                    {locale === 'es'
                        ? 'Tu armario personal está listo. Ahora puedes subir tus prendas.'
                        : 'Your personal wardrobe is ready. You can now upload your clothing items.'}
                </p>
                <button
                    onClick={handleDismissWelcome}
                    className="w-full bg-ac-taupe text-white py-3 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-gold transition-all flex items-center justify-center gap-2"
                >
                    <span>{locale === 'es' ? 'Comenzar a Subir' : 'Start Uploading'}</span>
                    <ChevronRight size={14} />
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

                </div>
            </motion.div>
        </>
    );
}
