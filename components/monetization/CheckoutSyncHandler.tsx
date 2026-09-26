
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { syncStripePurchases } from "@/app/actions/commerce";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function CheckoutSyncHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const t = useTranslations("CheckoutSync");

    useEffect(() => {
        const isSuccess = searchParams.get("checkout_success") === "true";

        if (isSuccess) {
            const sync = async () => {
                const toastId = toast.loading(t("verifying"));
                try {
                    const res = await syncStripePurchases();
                    if ("error" in res && res.error) {
                        toast.error(t("failed"), { id: toastId });
                    } else if ("restored" in res && (res.restored > 0 || res.settled > 0)) {
                        // Granted now, or already granted by the webhook.
                        toast.success(t("unlocked"), { id: toastId });
                        router.refresh();
                    } else if ("pending" in res && res.pending > 0) {
                        toast.info(t("pending"), { id: toastId });
                    } else {
                        // Used to say "Content Unlocked" here too, when
                        // nothing had been found at all.
                        toast.warning(t("notFound"), { id: toastId });
                    }
                } catch {
                    toast.error(t("failed"), { id: toastId });
                } finally {
                    // Clean URL
                    router.replace(pathname);
                }
            };

            sync();
        }
    }, [searchParams, router, pathname, t]);

    return null; // Logic only, no UI
}
