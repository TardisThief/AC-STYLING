import { Download } from "lucide-react";
import type { VaultResource } from "@/app/lib/types";

/**
 * One downloadable row. Shared so the chapter panel and the masterclass modal
 * cannot drift apart — this markup was previously copy-pasted per page.
 */
export default function ResourceLinkRow({ resource }: { resource: VaultResource }) {
    return (
        <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 bg-white/40 hover:bg-white/60 border border-transparent hover:border-ac-gold/20 transition-all rounded-sm group text-left"
        >
            <span className="text-sm font-bold text-ac-taupe group-hover:text-ac-olive truncate">
                {resource.name}
            </span>
            <Download size={14} className="text-ac-gold ml-2 shrink-0" aria-hidden="true" />
        </a>
    );
}
