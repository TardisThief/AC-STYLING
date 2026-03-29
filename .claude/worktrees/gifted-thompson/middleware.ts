
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
    // 1. Run Supabase middleware (Refresh session, protect routes)
    // This will check if we are in /vault and redirect if not logged in
    const response = await updateSession(request);

    // If Supabase Redirected (Status 307 etc), return that response immediately
    if (response.status >= 300 && response.status < 400) {
        return response;
    }

    // 2. Run next-intl middleware for everything else
    const intlMiddleware = createMiddleware(routing);
    const intlResponse = intlMiddleware(request);

    // Merge cookies from Supabase response (new session tokens) to Intl response
    response.cookies.getAll().forEach((cookie) => {
        intlResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return intlResponse;
}

export const config = {
    // Match all pathnames except for
    matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)']
};
