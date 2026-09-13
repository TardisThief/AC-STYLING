# Design: Email-Action Rate Limiting

**Date:** 2026-07-10
**Status:** Approved (pending spec review)
**Branch:** `Dev`
**Audit item:** P1 — "No rate limiting / CAPTCHA on email actions → mail-bombing, Resend cost abuse, enumeration."

## Problem

The four transactional-email server actions in `app/actions/auth.ts` can be
invoked without limit:

- `signInWithMagicLink(email, redirectTo?)`
- `requestPasswordReset(email)`
- `signUpWithMagicLink(email, redirectTo?)`
- the resend action (~line 203)

Each generates a Supabase auth link and sends an email via Resend. With no
throttle, an attacker can mail-bomb a victim's inbox, run up Resend cost/quota,
and probe for registered accounts (enumeration). The actions already have access
to request headers (`headers()`), so the client IP is available.

## Scope

Rate-limiting only. **No CAPTCHA** this pass (decided: CAPTCHA adds a
third-party widget + verification + form UI and can follow later if abuse
persists). No UI changes beyond surfacing a friendly "too many requests" error.

## Approach

Chosen of three considered:

1. **Atomic Postgres RPC (chosen).** One table + one `plpgsql` function that
   atomically increments/resets a fixed-window counter and returns allow/deny in
   a single round-trip. No race conditions.
2. App-side read-then-write. Rejected: multiple round-trips and race-prone under
   concurrency.
3. Per-attempt log table + count-in-window. Rejected: more storage and needs
   cleanup; no real benefit over the counter for this use.

State lives in **Supabase Postgres** (decided) — no new infrastructure, env
vars, or cost. Email actions are low-frequency, so per-request DB writes are a
non-issue.

## Data (new migration — additive, non-destructive)

`supabase/migrations/<ts>_email_rate_limits.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) may read/write.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text, p_max integer, p_window interval
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count, window_start INTO v_count, v_start;

  -- Allowed when this request is within the max for the current window.
  RETURN v_count <= p_max;
END;
$$;
```

- Atomic via a single `INSERT ... ON CONFLICT ... RETURNING`.
- `SECURITY DEFINER` so it runs regardless of caller role; still only reachable
  through the service-role client in app code.
- Fixed-window semantics (simple, adequate). A stale row simply resets on its
  next hit; an optional periodic cleanup can be added later but isn't required.

## App helper — `app/lib/rate-limit.ts`

```
export interface RateLimitResult { allowed: boolean; retryAfterSeconds?: number }

// Runs two checks via the admin (service-role) client; blocks if EITHER trips.
export async function checkEmailRateLimit(email, ip): Promise<RateLimitResult>
```

- Keys: `email:<lowercased-trimmed-email>` and `ip:<ip>`.
- Defaults (constants, tunable): **per-email 3 / 15 min**, **per-IP 10 / hour**.
- IP source: first entry of `x-forwarded-for` (Vercel-set), fallback `x-real-ip`;
  if no IP is resolvable, skip the IP check (don't block on missing IP).
- `retryAfterSeconds` derived from the window for the friendly message.

## Wiring

Each of the four auth actions, at the very top (before generating a link or
calling Resend):

```
const ip = /* from headers() */;
const { allowed } = await checkEmailRateLimit(email, ip);
if (!allowed) return { error: 'Too many requests. Please try again in a few minutes.' };
```

Returned in the existing `{ error }` shape the forms already handle.

## Error handling — fail OPEN

If the RPC throws (migration not yet applied, DB hiccup), log a warning and
**allow** the request. A limiter glitch must never lock legitimate users out of
login. Trade-off: throttle is inactive during an outage — acceptable for an
anti-abuse control. This also makes deploy safe: code can ship before the
migration is applied (limiting stays inactive until then).

## Deploy coordination (shared DB)

1. Ship the code (fail-open → no behavior change on prod).
2. Apply the additive migration in Supabase → limiting activates.

Old prod code ignores the new table/function, so it's safe on the shared DB.
Migration is additive (CREATE TABLE/FUNCTION), non-destructive, reversible.

## Testing

Unit tests for `checkEmailRateLimit` with a mocked `rpc`:

- allowed when under both limits,
- blocked when the email limit trips,
- blocked when the IP limit trips,
- fail-open (allowed) when the RPC throws,
- skips the IP check when no IP is available.

## Out of scope

- CAPTCHA / bot challenge.
- Rate-limiting non-email endpoints (the helper is reusable if wanted later).
- Distributed sliding-window precision (fixed-window is sufficient here).
- Automatic cleanup of stale `rate_limits` rows (rows self-reset; optional later).
