import { createAdminClient } from '@/utils/supabase/admin';

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds?: number;
}

const EMAIL_MAX = 3;
const EMAIL_WINDOW_SECONDS = 15 * 60; // 15 minutes
const IP_MAX = 10;
const IP_WINDOW_SECONDS = 60 * 60; // 1 hour

/**
 * Atomically consume one unit against `key`. Returns true when the request is
 * within `max` for the current fixed window. Fails OPEN (returns true) on any
 * error so a limiter problem never blocks a legitimate auth request.
 */
async function consume(key: string, max: number, windowSeconds: number): Promise<boolean> {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc('check_rate_limit', {
            p_key: key,
            p_max: max,
            p_window: `${windowSeconds} seconds`,
        });
        if (error) {
            console.warn('[rate-limit] check failed, allowing:', error.message);
            return true;
        }
        return data === true;
    } catch (err) {
        console.warn('[rate-limit] check threw, allowing:', err);
        return true;
    }
}

/**
 * Throttle a transactional-email action by both the target email and the caller
 * IP. Blocks if either dimension is over its limit.
 */
export async function checkEmailRateLimit(email: string, ip: string | null): Promise<RateLimitResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const emailAllowed = await consume(`email:${normalizedEmail}`, EMAIL_MAX, EMAIL_WINDOW_SECONDS);
    const ipAllowed = ip ? await consume(`ip:${ip}`, IP_MAX, IP_WINDOW_SECONDS) : true;

    if (emailAllowed && ipAllowed) return { allowed: true };

    return {
        allowed: false,
        retryAfterSeconds: !emailAllowed ? EMAIL_WINDOW_SECONDS : IP_WINDOW_SECONDS,
    };
}
