"use client";

import { Link } from "@/i18n/routing";
import { trackCta, type CtaSection, type CtaTarget } from "@/app/lib/analytics";

/**
 * A call to action that reports which section converted.
 *
 * The sales page is a server component, so the click handler has to live in a
 * client boundary. This is that boundary and nothing else: it renders a normal
 * link, so it still works with JavaScript disabled and the analytics call is
 * strictly additive.
 *
 * `internal` routes through the i18n Link (locale-aware); anything else is a
 * plain anchor, since anchors and external URLs must not be localised.
 */

interface Props {
    href: string;
    section: CtaSection;
    target: CtaTarget;
    className?: string;
    internal?: boolean;
    external?: boolean;
    children: React.ReactNode;
}

export default function TrackedCta({
    href,
    section,
    target,
    className,
    internal = false,
    external = false,
    children,
}: Props) {
    const onClick = () => trackCta(section, target);

    if (internal) {
        return (
            <Link href={href} className={className} onClick={onClick}>
                {children}
            </Link>
        );
    }

    return (
        <a
            href={href}
            className={className}
            onClick={onClick}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
            {children}
        </a>
    );
}
