'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Who is looking at a prerendered page: nobody, an anonymous guest, or a
 * member with a real account. `unknown` until the browser has checked.
 *
 * For choosing what a public page *shows* (the sales page cannot read cookies
 * on the server), never for deciding what anyone may do: every action that
 * matters re-checks the session on the server. Reads the local session, so it
 * costs no request, and follows sign-in and sign-out while the page is open.
 */
export type SessionKind = 'unknown' | 'none' | 'guest' | 'member';

type MaybeUser = { is_anonymous?: boolean } | null | undefined;
const kindOf = (user: MaybeUser): SessionKind => (!user ? 'none' : user.is_anonymous ? 'guest' : 'member');

export function useSessionKind(): SessionKind {
    const [kind, setKind] = useState<SessionKind>('unknown');

    useEffect(() => {
        const supabase = createClient();
        let active = true;

        supabase.auth.getSession().then(({ data }) => {
            if (active) setKind(kindOf(data.session?.user));
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (active) setKind(kindOf(session?.user));
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    return kind;
}
