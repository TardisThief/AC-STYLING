
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
                setAll(cookiesToSet: any[]) {
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
    // Exclude public paths: /vault/join (Signup) and /vault/gallery (Marketing)
    const isVaultPublicRoute =
        request.nextUrl.pathname.includes('/vault/join') ||
        request.nextUrl.pathname.includes('/vault/gallery');

    if (request.nextUrl.pathname.includes('/vault') && !isVaultPublicRoute && !user) {
        const url = request.nextUrl.clone()
        // ... (existing redirect logic)
        const pathSegments = request.nextUrl.pathname.split('/');

        // pathSegments[0] is empty string (split on leading slash)
        // pathSegments[1] is the first segment (e.g., 'en', 'es', or 'vault')
        const firstSegment = pathSegments[1];

        // Check if the first segment is a supported locale
        const locale = routing.locales.includes(firstSegment as any) ? firstSegment : 'en';

        url.pathname = `/${locale}/login`
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
