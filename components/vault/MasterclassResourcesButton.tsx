"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { VaultResource } from "@/app/lib/types";
import ResourceLinkRow from "./ResourceLinkRow";

/**
 * Opens the masterclass's own resources — the workbooks and charts that belong
 * to the whole collection rather than to one module — from the masterclass
 * screen. The same files also appear above each module's own resources.
 *
 * Renders nothing when there are none, so the screen never shows an empty
 * promise. The caller decides entitlement; this only draws the button.
 */
export default function MasterclassResourcesButton({ resources }: { resources: VaultResource[] }) {
    const t = useTranslations('Foundations');
    const [isOpen, setIsOpen] = useState(false);

    if (resources.length === 0) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 border border-ac-taupe/30 text-ac-taupe px-6 py-3 rounded-sm hover:border-ac-gold hover:text-ac-olive transition-colors uppercase tracking-widest text-xs font-bold"
            >
                <FolderOpen size={16} aria-hidden="true" />
                {t('masterclassResources')}
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title={t('masterclassResources')}
                widthClass="max-w-lg"
            >
                <div className="px-8 py-6 space-y-3">
                    {resources.map((resource, i) => (
                        <ResourceLinkRow key={`${resource.url}-${i}`} resource={resource} />
                    ))}
                </div>
            </Modal>
        </>
    );
}
