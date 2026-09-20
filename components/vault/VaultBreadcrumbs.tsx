'use client';

import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * One crumb. Either a fixed part of the Vault's structure, named through the
 * `Breadcrumbs` namespace by `key`, or a piece of database content already
 * resolved to the reader's locale by the page, passed as `label`.
 */
export interface Crumb {
    /** Message key under `Breadcrumbs` — for the fixed parts of the hierarchy. */
    key?: 'courses' | 'foundations' | 'masterclass' | 'essenceLab';
    /** Literal text — for titles that come from the database. */
    label?: string;
    /** Omitted on the last crumb, which is the page you are already on. */
    href?: string;
}

/**
 * Positional breadcrumbs for the deeper Vault routes.
 *
 * These pages each had a single "back" link, which answers "how do I leave"
 * but not "where am I" — and `foundations/[slug]/essence-lab` sits four levels
 * down. The trail replaces that link rather than joining it: a breadcrumb
 * whose last hop is the same destination as an adjacent back button is just
 * the same control twice.
 *
 * No `BreadcrumbList` structured data here on purpose. Every route this
 * renders on is gated and ships `noindex`, so schema describing it would
 * be markup for a crawler that is being told not to look.
 */
export default function VaultBreadcrumbs({ trail }: { trail: Crumb[] }) {
    const t = useTranslations('Breadcrumbs');
    const text = (c: Crumb) => (c.key ? t(c.key) : (c.label ?? ''));

    // The Vault root is implicit in every trail rather than repeated at each
    // call site, where it could be forgotten or worded differently.
    const crumbs: Crumb[] = [{ key: undefined, label: t('vault'), href: '/vault' }, ...trail];

    return (
        <nav aria-label={t('label')} className="mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-widest text-ac-taupe/60">
                {crumbs.map((crumb, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                        <Fragment key={`${crumb.key ?? crumb.label}-${i}`}>
                            <li className="flex items-center">
                                {last || !crumb.href ? (
                                    // The current page is named but not a link, and
                                    // aria-current tells a screen reader which it is.
                                    <span
                                        aria-current={last ? 'page' : undefined}
                                        className={last ? 'text-ac-taupe' : undefined}
                                    >
                                        {text(crumb)}
                                    </span>
                                ) : (
                                    <Link
                                        href={crumb.href}
                                        className="hover:text-ac-olive focus-visible:text-ac-olive focus-visible:outline-none transition-colors"
                                    >
                                        {text(crumb)}
                                    </Link>
                                )}
                            </li>
                            {!last && (
                                <li aria-hidden="true" className="flex items-center text-ac-taupe/30">
                                    <ChevronRight size={12} />
                                </li>
                            )}
                        </Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}
