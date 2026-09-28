"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addMyWardrobeItem, getMyItemUploadUrl } from "@/app/actions/wardrobes";
import { CATEGORY_VALUES } from "@/app/lib/validation/wardrobe-items";

/**
 * A Studio client adding a garment to her own wardrobe, from My Studio.
 *
 * Owner decision 2026-09-28. Her view used to open the stylist's ingestion
 * modal — boutique import, the admin-only link scraper, and an upload that
 * wrote her words into the stylist's note. This is the one thing she needs: a
 * photo, a category, and her own note. The photo goes from her browser
 * straight to a signed URL in her own folder (file bytes never pass through a
 * server action); the item is registered by a guarded action and waits for the
 * stylist to review it (tests/integration/my-wardrobe-upload.test.ts).
 */
/** The same 15 MB the other upload paths allow; checked here to say so in her language. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function ClientAddPhoto({
    wardrobeId,
    onClose,
    onAdded,
}: {
    wardrobeId: string;
    onClose: () => void;
    onAdded: () => void;
}) {
    const t = useTranslations("MyStudio");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [category, setCategory] = useState<string>("Tops");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!file) return setPreview(null);
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const fail = (code?: string) => {
        const key = code === "full" || code === "rate" ? code : "failed";
        toast.error(t(`add.errors.${key}`));
    };

    const submit = async () => {
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) return toast.error(t("add.errors.tooLarge"));
        setSaving(true);
        try {
            const url = await getMyItemUploadUrl(wardrobeId, file.name);
            if (!url.success || !url.signedUrl || !url.filePath) return fail(url.error);

            const put = await fetch(url.signedUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type || "image/jpeg" },
                body: file,
            });
            if (!put.ok) return fail();

            const added = await addMyWardrobeItem({
                wardrobe_id: wardrobeId,
                file_path: url.filePath,
                category,
                client_note: note,
            });
            if (!added.success) return fail(added.error);

            toast.success(t("add.added"));
            onAdded();
            onClose();
        } catch {
            fail();
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-ac-taupe/80 backdrop-blur-md flex items-center justify-center p-6"
        >
            <div role="dialog" aria-modal="true" aria-labelledby="client-add-photo-title" className="bg-white max-w-md w-full rounded-sm shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    aria-label={t("close")}
                    className="absolute top-4 right-4 text-ac-taupe/40 hover:text-ac-taupe transition-colors"
                >
                    <X size={20} aria-hidden="true" />
                </button>

                <div className="p-6 border-b border-ac-taupe/10 pr-12">
                    <h3 id="client-add-photo-title" className="font-serif text-2xl text-ac-taupe">{t("add.title")}</h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-ac-taupe/40 mt-1">{t("add.subtitle")}</p>
                </div>

                <div className="p-6 space-y-6">
                    <label className="aspect-[4/3] border-2 border-dashed border-ac-taupe/20 rounded-sm flex flex-col items-center justify-center gap-3 bg-ac-taupe/5 relative overflow-hidden cursor-pointer">
                        {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable image
                            <img src={preview} className="absolute inset-0 w-full h-full object-contain" alt="" />
                        ) : (
                            <Camera size={32} className="text-ac-taupe/20" aria-hidden="true" />
                        )}
                        <span className={`relative text-[10px] font-bold uppercase tracking-widest ${preview ? "bg-white/90 px-3 py-1 rounded-full text-ac-taupe" : "text-ac-taupe/50"}`}>
                            {preview ? t("add.change") : t("add.choose")}
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            className="sr-only"
                        />
                    </label>

                    <div>
                        <p className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-3">{t("add.category")}</p>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_VALUES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    aria-pressed={category === cat}
                                    className={`px-3 py-1 rounded-sm text-[10px] uppercase font-bold tracking-tighter border transition-all ${category === cat ? "bg-ac-taupe text-white border-ac-taupe" : "border-ac-taupe/10 text-ac-taupe/60"}`}
                                >
                                    {t(`categories.${cat}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="client-add-note" className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">{t("add.note")}</label>
                        <textarea
                            id="client-add-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t("add.notePlaceholder")}
                            maxLength={2000}
                            className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm p-3 text-sm focus:outline-none focus:border-ac-gold h-24 resize-none"
                        />
                    </div>

                    <button
                        onClick={submit}
                        disabled={saving || !file}
                        className="w-full bg-ac-gold text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-taupe transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                        {t("add.submit")}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
