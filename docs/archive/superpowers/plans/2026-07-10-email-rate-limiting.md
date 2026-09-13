# Email-Action Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Throttle the four transactional-email server actions (magic-link sign-in, password reset, magic-link signup, seamless password signup) to stop mail-bombing, Resend cost abuse, and account enumeration.

**Architecture:** A pure helper `checkEmailRateLimit(email, ip)` calls an atomic Postgres RPC (`check_rate_limit`) twice — once per-email, once per-IP — through the service-role client, blocking if either window is exceeded. The counter state lives in a new `rate_limits` table. The helper fails **open** (allows on RPC error) so a limiter hiccup never blocks login, which also lets the code ship before the DB migration is applied.

**Tech Stack:** Next.js 16 server actions, Supabase Postgres (`plpgsql` RPC), the existing service-role client (`@/utils/supabase/admin`), Vitest.

## Global Constraints

- Work on the `Dev` branch. Do not merge to `main`, push, or apply SQL to the live Supabase — the user does that.
- DB changes are delivered as reviewable SQL under `supabase/migrations/`; the agent does NOT apply them (single shared Supabase instance = production).
- Path alias: `@/*` → repo root.
- Server actions start with `"use server"` and return the existing `{ error?: string; success?: boolean }` shape the auth forms already handle.
- Thresholds (exact): per-email **3 requests / 15 min**; per-IP **10 requests / 60 min**.
- Fail-open on any rate-limit error (log a warning, allow the request).

---

### Task 1: Rate-limit helper (pure logic)

**Files:**
- Create: `app/lib/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/utils/supabase/admin` (has `.rpc(name, params)`).
- Produces:
  - `interface RateLimitResult { allowed: boolean; retryAfterSeconds?: number }`
  - `async function checkEmailRateLimit(email: string, ip: string | null): Promise<RateLimitResult>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ rpc: mockRpc })),
}))

import { checkEmailRateLimit } from '@/app/lib/rate-limit'

describe('checkEmailRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('allows when both email and IP are under the limit', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })

        const result = await checkEmailRateLimit('User@Example.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
        // email key first, then ip key
        expect(mockRpc).toHaveBeenNthCalledWith(1, 'check_rate_limit', {
            p_key: 'email:user@example.com',
            p_max: 3,
            p_window: '900 seconds',
        })
        expect(mockRpc).toHaveBeenNthCalledWith(2, 'check_rate_limit', {
            p_key: 'ip:1.2.3.4',
            p_max: 10,
            p_window: '3600 seconds',
        })
    })

    it('blocks when the email limit trips (retryAfter = email window)', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })
        mockRpc.mockResolvedValueOnce({ data: false, error: null }) // email call

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(false)
        expect(result.retryAfterSeconds).toBe(900)
    })

    it('blocks when the IP limit trips (retryAfter = IP window)', async () => {
        mockRpc
            .mockResolvedValueOnce({ data: true, error: null })  // email
            .mockResolvedValueOnce({ data: false, error: null }) // ip

        const result = await checkEmailRateLimit('a@b.com', '9.9.9.9')

        expect(result.allowed).toBe(false)
        expect(result.retryAfterSeconds).toBe(3600)
    })

    it('fails open (allows) when the RPC returns an error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
    })

    it('fails open (allows) when the RPC throws', async () => {
        mockRpc.mockRejectedValue(new Error('db down'))

        const result = await checkEmailRateLimit('a@b.com', '1.2.3.4')

        expect(result.allowed).toBe(true)
    })

    it('skips the IP check when no IP is available', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })

        const result = await checkEmailRateLimit('a@b.com', null)

        expect(result.allowed).toBe(true)
        expect(mockRpc).toHaveBeenCalledTimes(1)
        expect(mockRpc).toHaveBeenCalledWith('check_rate_limit', {
            p_key: 'email:a@b.com',
            p_max: 3,
            p_window: '900 seconds',
        })
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/rate-limit.test.ts`
Expected: FAIL — cannot import `checkEmailRateLimit` (module does not exist).

- [ ] **Step 3: Write the implementation**

Create `app/lib/rate-limit.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/rate-limit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "Add email-action rate-limit helper (Postgres RPC, fail-open)"
```

---

### Task 2: Database migration (table + RPC)

**Files:**
- Create: `supabase/migrations/20260710_04_email_rate_limits.sql`
- Modify: `supabase/migrations/README.md` (add the row for this migration)

**Interfaces:**
- Produces: table `public.rate_limits(key, count, window_start)` and function
  `public.check_rate_limit(p_key text, p_max integer, p_window interval) returns boolean`,
  called by Task 1's `consume()`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260710_04_email_rate_limits.sql`:

```sql
-- P1 — Rate limiting for the transactional-email auth actions.
--
-- Additive and non-destructive: a counter table + an atomic fixed-window
-- function. Safe to apply anytime; old code ignores it. The app calls
-- check_rate_limit via the service-role client (see app/lib/rate-limit.ts) and
-- fails OPEN if this function is absent, so the code can ship before this runs.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Lock the table down: RLS on with no policies means anon/authenticated cannot
-- touch it. The service role (used by the app) and SECURITY DEFINER function
-- bypass RLS.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text, p_max integer, p_window interval
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
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
  RETURNING count INTO v_count;

  -- Allowed when this request is within the max for the current window.
  RETURN v_count <= p_max;
END;
$$;
```

- [ ] **Step 2: Add the README row**

In `supabase/migrations/README.md`, under the migrations table, add:

```markdown
| `20260710_04_email_rate_limits.sql` | P1 email rate limiting | Additive (new `rate_limits` table + `check_rate_limit` function). Safe to apply anytime; the app fails open if it's absent, so code can ship first. Reversible: `DROP FUNCTION public.check_rate_limit; DROP TABLE public.rate_limits;` |
```

- [ ] **Step 3: Verify the SQL is well-formed (manual, no live DB)**

Read the file back and confirm: the `ON CONFLICT` clause references `public.rate_limits.<col>` (not bare column names, which are ambiguous inside the upsert), and the function returns `boolean`. There is no automated DB test in this repo (schema is managed in Supabase); the user applies and verifies this migration manually with:

```sql
-- after applying:
SELECT public.check_rate_limit('test:key', 2, '10 seconds'); -- true  (count 1)
SELECT public.check_rate_limit('test:key', 2, '10 seconds'); -- true  (count 2)
SELECT public.check_rate_limit('test:key', 2, '10 seconds'); -- false (count 3 > 2)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_04_email_rate_limits.sql supabase/migrations/README.md
git commit -m "Add email rate-limit migration (rate_limits table + check_rate_limit RPC)"
```

---

### Task 3: Wire the four email actions

**Files:**
- Modify: `app/actions/auth.ts` (functions at lines 8, 56, 99, 192)

**Interfaces:**
- Consumes: `checkEmailRateLimit(email, ip)` from `@/app/lib/rate-limit` (Task 1).

- [ ] **Step 1: Add the import**

At the top of `app/actions/auth.ts`, alongside the existing imports, add:

```ts
import { checkEmailRateLimit } from '@/app/lib/rate-limit';
```

- [ ] **Step 2: Add a local IP-extraction + guard to `signInWithMagicLink`**

In `signInWithMagicLink` (line 8), immediately after `const origin = (await headers()).get('origin');`, insert:

```ts
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
```

(The existing `origin` line already calls `headers()`; reuse is fine — the extra call is cheap and keeps the diff localized. Do not remove the existing `origin` line.)

- [ ] **Step 3: Repeat the guard in `requestPasswordReset` (line 56)**

After its `const origin = (await headers()).get('origin');` line, insert the same block:

```ts
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
```

- [ ] **Step 4: Repeat the guard in `signUpWithMagicLink` (line 99)**

After its `const origin = (await headers()).get('origin');` line, insert the same block (email param is in scope):

```ts
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
```

- [ ] **Step 5: Repeat the guard in `signUpSeamless` (line 192)**

`signUpSeamless` reads `email` from `formData` at line 193 and validates fields at line 197. Insert the guard **after** the `if (!email || !password || !fullName)` validation block (so we have a real email), before `const { createAdminClient } = ...` at line 201:

```ts
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null;
    const rate = await checkEmailRateLimit(email, ip);
    if (!rate.allowed) {
        return { error: 'Too many requests. Please try again in a few minutes.' };
    }
```

- [ ] **Step 6: Verify the suite and lint still pass**

Run: `npx vitest run tests/unit/rate-limit.test.ts && npx eslint app/actions/auth.ts app/lib/rate-limit.ts`
Expected: rate-limit tests PASS; no **new** eslint errors in these files (auth.ts has pre-existing `no-explicit-any`/unused-var warnings on unrelated lines — do not touch them).

- [ ] **Step 7: Commit**

```bash
git add app/actions/auth.ts
git commit -m "Rate-limit the four email auth actions (per-email + per-IP)"
```

---

### Task 4: Update the audit roadmap

**Files:**
- Modify: `AUDIT.md` (P1 section)

- [ ] **Step 1: Mark the item done**

In `AUDIT.md`, in the `### P1 — next` paragraph, change `rate limiting / CAPTCHA on email actions` to:

```
~~rate limiting on email actions~~ (done: `app/lib/rate-limit.ts` + migration 04; CAPTCHA deferred)
```

- [ ] **Step 2: Commit**

```bash
git add AUDIT.md
git commit -m "AUDIT: mark email rate-limiting P1 item done"
```

---

## Verification (after all tasks)

- `npm run test:run` — full suite green (155 tests: 154 prior + the new rate-limit file replaces none; expect ~160).
- Manual, once the user applies migration 04: hit a login form >3 times with the same email inside 15 min and confirm the 4th returns "Too many requests." Before the migration is applied, confirm login still works normally (fail-open).
