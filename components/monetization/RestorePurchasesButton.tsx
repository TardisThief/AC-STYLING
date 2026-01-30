
"use client";

import { useState } from "react";
import { syncStripePurchases } from "@/app/actions/commerce";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";

export default function RestorePurchasesButton() {
    const [loading, setLoading] = useState(false);

    const handleRestore = async () => {
        setLoading(true);
        try {
            const res = await syncStripePurchases();
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(res.message);
            }
        } catch (e) {
            toast.error("Failed to sync purchases.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRestore}
            disabled={loading}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-ac-taupe/40 hover:text-ac-taupe transition-colors"
        >
            <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
            Restore Purchases
        </button>
    );
}
