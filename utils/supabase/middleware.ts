
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: object }>) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new Response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protect /vault routes
    // Exclude public paths: /vault/join (signup), and the locale-less Vault
    // index. A bare /vault -- the shape an Instagram bio link takes -- must
    // reach next-intl so it can redirect to /en/vault, where the rewrite below
    // turns it into the public sales page. Without this it fell through to the
    // gate and bounced to /login.
    const isVaultPublicRoute =
        request.nextUrl.pathname.includes('/vault/join') ||
        /^\/vault\/?$/.test(request.nextUrl.pathname);

    // The Vault index is the public sales page. An anonymous visitor is
    // rewritten to /vault-landing, which lives outside the member layout and is
    // statically prerendered; the URL they see stays /vault. Matched EXACTLY --
    // a prefix match here would unlock the entire library.
    // Locale-prefixed only: a bare /vault falls through to next-intl, which
    // redirects it to /en/vault, and the rewrite happens on that request.
    const vaultIndex = /^\/(en|es)\/vault\/?$/;
    const vaultMatch = request.nextUrl.pathname.match(vaultIndex);
    if (vaultMatch && !user) {
        const locale = vaultMatch[1];

        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/vault-landing`;
        const rewritten = NextResponse.rewrite(url);
        // Carry any refreshed session cookies onto the rewritten response.
        supabaseResponse.cookies.getAll().forEach((c) =>
            rewritten.cookies.set(c.name, c.value)
        );
        return rewritten;
    }

    if (request.nextUrl.pathname.includes('/vault') && !isVaultPublicRoute && !user) {
        const url = request.nextUrl.clone()
        // ... (existing redirect logic)
        const pathSegments = request.nextUrl.pathname.split('/');

        // pathSegments[0] is empty string (split on leading slash)
        // pathSegments[1] is the first segment (e.g., 'en', 'es', or 'vault')
        const firstSegment = pathSegments[1];

        // Check if the first segment is a supported locale
        const locale = routing.locales.includes(firstSegment as typeof routing.locales[number]) ? firstSegment : 'en';

        url.pathname = `/${locale}/login`
        url.searchParams.set('next', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
