"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles, Send, Link as LinkIcon, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
// We need to import the server action. 
// Note: In Next.js, we can import server actions into client components.
// However, the action file must have "use server" at top.
import { generateInvitation } from "@/app/actions/invitation";

export default function InvitationGenerator({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [note, setNote] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");

    const handleGenerate = async () => {
        if (!name) return toast.error("Client Name is required");
        setIsLoading(true);

        try {
            const result = await generateInvitation(name, email, note);

            if (result.success && result.uploadToken) {
                // Construct full URL using the wardrobe upload token
                const origin = window.location.origin;
                const link = `${origin}/studio/upload/${result.uploadToken}`;
                setGeneratedLink(link);
                toast.success("Wardrobe Upload Link Generated!");
            } else {
                toast.error(result.error || "Failed to generate link");
            }
        } catch (err) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        toast.success("Link copied to clipboard");
    };

    const shareWhatsApp = () => {
        const text = encodeURIComponent(`Hi ${name}, Alejandra is ready for your Style Transformation. access your private portal here: ${generatedLink}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div className="bg-white max-w-md w-full p-8 rounded-sm shadow-2xl relative">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-ac-taupe/20 hover:text-ac-taupe transition-colors"
            >
                {/* SVG for X */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <h3 className="font-serif text-2xl text-ac-taupe mb-2 flex items-center gap-2">
                <Sparkles className="text-ac-gold" size={20} />
                Concierge Invite
            </h3>
            <p className="text-xs text-ac-taupe/40 uppercase tracking-widest font-bold mb-8">Generate a private intake portal</p>

            {!generatedLink ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Client Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Maria Design"
                            className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-ac-gold transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-ac-taupe/40 mb-2">Email (Optional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="For your reference"
                            className="w-full bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-ac-gold transition-all"
                        />
                    </div>

                    <div className="bg-ac-taupe/5 p-4 rounded-sm text-xs text-ac-taupe/60 italic">
                        <p>This creates a wardrobe with a secure upload link. No guest account needed.</p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !name}
                        className="w-full bg-ac-taupe text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-ac-gold transition-all disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={16} /> : <LinkIcon size={16} />}
                        Generate Secure Link
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-ac-gold/10 p-6 rounded-sm text-center border border-ac-gold/20">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ac-gold mb-2">Invitation Ready</p>
                        <p className="font-serif text-xl text-ac-taupe">{name}'s Portal</p>
                    </div>

                    <div className="flex gap-2">
                        <input
                            readOnly
                            value={generatedLink}
                            className="flex-1 bg-ac-taupe/5 border border-ac-taupe/10 rounded-sm px-3 text-xs text-ac-taupe/60 select-all focus:outline-none"
                        />
                        <button
                            onClick={copyToClipboard}
                            className="p-3 bg-ac-taupe text-white rounded-sm hover:bg-ac-taupe/80 transition-all"
                            title="Copy Link"
                        >
                            <Copy size={16} />
                        </button>
                    </div>

                    <button
                        onClick={shareWhatsApp}
                        className="w-full bg-[#25D366] text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md"
                    >
                        <Send size={16} />
                        Share via WhatsApp
                    </button>

                    <button
                        onClick={() => {
                            setGeneratedLink("");
                            setName("");
                            setEmail("");
                            onClose();
                        }}
                        className="w-full py-2 text-xs text-ac-taupe/40 hover:text-ac-taupe uppercase tracking-widest font-bold"
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
