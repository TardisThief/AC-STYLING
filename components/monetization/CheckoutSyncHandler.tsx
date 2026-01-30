
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { syncStripePurchases } from "@/app/actions/commerce";
import { toast } from "sonner";

export default function CheckoutSyncHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const isSuccess = searchParams.get("checkout_success") === "true";

        if (isSuccess) {
            const sync = async () => {
                const toastId = toast.loading("Verifying your purchase...");
                try {
                    const res = await syncStripePurchases();
                    if (res.error) {
                        toast.error("Could not verify purchase automatically. Please use the Restore button.", { id: toastId });
                    } else {
                        toast.success("Purchase Verified! Content Unlocked.", { id: toastId });
                        // Refresh to show unlocked content
                        router.refresh();
                    }
                } catch (e) {
                    toast.error("Verification failed.", { id: toastId });
                } finally {
                    // Clean URL
                    router.replace(pathname);
                }
            };

            sync();
        }
    }, [searchParams, router, pathname]);

    return null; // Logic only, no UI
}
