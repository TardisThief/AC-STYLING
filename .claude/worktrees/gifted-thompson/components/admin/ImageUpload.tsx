
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    bucket?: string;
    placeholder?: string;
}

export default function ImageUpload({ value, onChange, bucket = 'boutique', placeholder = "Upload image" }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }

        const file = e.target.files[0];
        await uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            onChange(publicUrl);
            toast.success("Image uploaded successfully");
        } catch (error: any) {
            console.error(error);
            toast.error("Error uploading image: " + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange("");
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            {value ? (
                <div className="relative group aspect-video w-full bg-black/5 rounded-sm overflow-hidden border border-ac-taupe/10">
                    <img src={value} alt="Preview" className="w-full h-full object-contain" />
                    <button
                        onClick={handleClear}
                        className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500 shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
                    >
                        <X size={16} />
                    </button>
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-white text-xs font-bold uppercase tracking-widest">Change Image</p>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`
                        border-2 border-dashed border-ac-taupe/20 rounded-sm p-8
                        flex flex-col items-center justify-center text-center
                        cursor-pointer transition-colors
                        ${uploading ? 'bg-ac-taupe/5 opacity-50 cursor-wait' : 'hover:bg-white/40 hover:border-ac-taupe/40'}
                    `}
                >
                    {uploading ? (
                        <Loader2 className="animate-spin text-ac-gold mb-2" size={24} />
                    ) : (
                        <Upload className="text-ac-taupe/40 mb-2" size={24} />
                    )}
                    <span className="text-xs font-bold uppercase tracking-widest text-ac-taupe/60">
                        {uploading ? "Uploading..." : placeholder}
                    </span>
                    <span className="text-[10px] text-ac-taupe/40 mt-1">
                        Click to browse or drag file here
                    </span>
                </div>
            )}
        </div>
    );
}
