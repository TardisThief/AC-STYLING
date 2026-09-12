
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
    // index. A bare /vault must reach next-intl so it can redirect to
    // /en/vault, which then redirects on to the public sales page. Without
    // this it falls through to the gate and bounces to /login.
    const isVaultPublicRoute =
        request.nextUrl.pathname.includes('/vault/join') ||
        /^\/vault\/?$/.test(request.nextUrl.pathname);

    // The Vault index is members-only. An anonymous visitor is redirected to
    // the public sales page at its own address.
    //
    // This used to be a rewrite -- same URL, two pages -- which caused two real
    // problems: the owner could never see her own sales page while signed in,
    // and Stripe's return URL landed a buyer back on the page she had just
    // bought from. One page, one address is simpler and both bugs disappear.
    // Locale-prefixed only: a bare /vault falls through to next-intl first.
    const vaultIndex = /^\/(en|es)\/vault\/?$/;
    const vaultMatch = request.nextUrl.pathname.match(vaultIndex);
    if (vaultMatch && !user) {
        const url = request.nextUrl.clone();
        url.pathname = `/${vaultMatch[1]}/vault-access`;
        url.search = request.nextUrl.search;
        return NextResponse.redirect(url);
    }

    // Match /vault as a whole path segment, not as a substring. `includes`
    // also caught /vault-access/* -- including its opengraph-image route,
    // which meant crawlers fetching the social card were redirected to login.
    const isVaultPath = /\/vault(\/|$)/.test(request.nextUrl.pathname);

    if (isVaultPath && !isVaultPublicRoute && !user) {
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
