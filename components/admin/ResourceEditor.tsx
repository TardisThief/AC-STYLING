"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, ChevronUp, ChevronDown, Link2 } from "lucide-react";
import { toast } from "sonner";
import { uploadResourceWithToast } from "@/app/lib/upload-client";
import type { StoredVaultResource } from "@/app/lib/types";

interface ResourceEditorProps {
    value: StoredVaultResource[];
    onChange: (next: StoredVaultResource[]) => void;
    /** Heading above the editor. */
    label?: string;
    /** Line under the heading explaining where these files surface. */
    hint?: string;
}

/**
 * The one resource list editor, shared by ChapterForm and MasterclassForm.
 *
 * It replaces the drop-a-PDF-and-live-with-the-filename block the chapter form
 * used to inline: the display name is what members read, so it is editable,
 * order is what they read it in, so it is movable, and not every resource lives
 * in our bucket, so a plain link can be added.
 *
 * Uploads go to the PRIVATE `vault-resources` bucket via a signed URL
 * (admin-only INSERT, 15 MB, pdf/zip) — the bytes never pass through a server
 * action — and are stored as `{ name, path }`. Members only ever get them as
 * short-lived signed links, after the access check (migration 30).
 */
export default function ResourceEditor({
    value,
    onChange,
    label = "Resources",
    hint,
}: ResourceEditorProps) {
    const [uploading, setUploading] = useState(false);
    const [linkName, setLinkName] = useState("");
    const [linkUrl, setLinkUrl] = useState("");

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            "application/pdf": [".pdf"],
            "application/zip": [".zip"],
        },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length === 0) return;

            setUploading(true);
            const file = acceptedFiles[0];
            const path = await uploadResourceWithToast(file, "File uploaded");
            if (path) onChange([...value, { name: file.name, path }]);
            setUploading(false);
        },
    });

    const rename = (index: number, name: string) =>
        onChange(value.map((r, i) => (i === index ? { ...r, name } : r)));

    const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const addLink = () => {
        const name = linkName.trim();
        const url = linkUrl.trim();
        if (!name) return toast.error("Give the link a name");
        // Matches resourceList() in app/lib/validation/parse.ts, so a bad link
        // is caught here instead of failing the whole save.
        if (!/^https?:\/\//.test(url)) return toast.error("The link must start with http:// or https://");
        onChange([...value, { name, url }]);
        setLinkName("");
        setLinkUrl("");
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-ac-taupe/80 uppercase tracking-widest">
                    {label}
                </label>
                {hint && <p className="text-[10px] text-ac-taupe/60 mt-1">{hint}</p>}
            </div>

            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors ${isDragActive
                    ? "border-ac-gold bg-ac-gold/5"
                    : "border-ac-taupe/20 hover:border-ac-gold/50"
                    }`}
            >
                <input {...getInputProps()} />
                <Upload size={20} className="mx-auto mb-2 text-ac-taupe/40" />
                <p className="text-xs text-ac-taupe/60">
                    {uploading ? "Uploading..." : "Drop a PDF or ZIP"}
                </p>
            </div>

            {/* External link */}
            <div className="flex flex-wrap gap-2 items-center">
                <input
                    type="text"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Link name"
                    className="flex-1 min-w-[8rem] bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-sm text-ac-taupe focus:outline-none focus:border-ac-gold"
                />
                <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-[2] min-w-[10rem] bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-ac-taupe focus:outline-none focus:border-ac-gold font-mono text-xs"
                />
                <button
                    type="button"
                    onClick={addLink}
                    className="flex items-center gap-1 px-3 py-2 bg-ac-taupe/10 text-ac-taupe rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-ac-taupe/20"
                >
                    <Link2 size={14} /> Add
                </button>
            </div>

            <div className="space-y-2">
                {value.map((r, i) => (
                    <div key={`${r.path ?? r.url}-${i}`} className="flex gap-2 items-center bg-white/20 p-2 rounded-sm">
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => move(i, -1)}
                                disabled={i === 0}
                                aria-label={`Move ${r.name} up`}
                                className="text-ac-taupe/50 hover:text-ac-taupe disabled:opacity-20 disabled:hover:text-ac-taupe/50"
                            >
                                <ChevronUp size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => move(i, 1)}
                                disabled={i === value.length - 1}
                                aria-label={`Move ${r.name} down`}
                                className="text-ac-taupe/50 hover:text-ac-taupe disabled:opacity-20 disabled:hover:text-ac-taupe/50"
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>

                        <input
                            type="text"
                            value={r.name}
                            onChange={(e) => rename(i, e.target.value)}
                            aria-label="Resource name"
                            className="flex-1 min-w-0 bg-white/40 border border-ac-taupe/10 rounded-sm p-2 text-xs text-ac-taupe focus:outline-none focus:border-ac-gold"
                        />

                        {r.path ? (
                            <span className="text-[10px] text-ac-taupe/50 shrink-0" title={r.path}>
                                Private file
                            </span>
                        ) : (
                            <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-ac-taupe/50 hover:text-ac-gold underline shrink-0"
                            >
                                Open
                            </a>
                        )}

                        <button
                            type="button"
                            onClick={() => remove(i)}
                            aria-label={`Remove ${r.name}`}
                            className="text-red-500 hover:text-red-700 shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
