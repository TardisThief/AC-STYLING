# Paid-path rehearsal — 2026-09-28

The first end-to-end run of every money path on the live site
(`www.theacstyle.com`), in Stripe **test mode**, before a real customer runs
any of it. The owner clicked; the agent checked the database, the emails and
the logs after each step, and fixed what broke.

**Status: complete.** Every journey below ran; six defects were found, and
all six are fixed, tested and deployed. The two sales-page gaps it also
exposed were closed the same day (end of this file).

## Setup

- Snapshot before starting: `backups/pre-rehearsal--2026-09-28T154726Z`.
- `check_fulfillments.mjs` before: `OK`. 3 accounts, 7 purchase rows (all
  detached by the 2026-09-26 clean slate), one active offer (`masterclass_pass`).
- Both test-mode webhook endpoints (www and dev) point at
  `/api/webhooks/stripe`. **They were not subscribed to `charge.refunded` or
  `charge.dispute.created`**, so the handler's refund/dispute admin alert had
  never fired. Both were subscribed through the API the same day; owner
  action 1, step 5 now lists all six events for the live endpoint.

## Accounts used

| Account | Why | Remove at cleanup |
|---|---|---|
| `manugomezwow@gmail.com` | existed since 2026-09-26 (owner testing) | yes |
| `thefirstfae@gmail.com` | new, created by its own guest checkout | yes |
| `manugomezwow+r2@gmail.com` | created by the agent (owner-approved) to reproduce the Profile bug with Playwright | yes |

## Journeys

| # | Journey | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Guest checkout, Masterclass Pass, email **already has an account** | Grant to that account; `/welcome` sends her to sign in | Fulfilment `completed` first attempt; pass to 2027-09-28; admin "New Sale". **No email of any kind**, while `/welcome` said one was sent. After login, **Profile → `/vault/join`** until reload. | Fixed (below) |
| 2 | Guest checkout, Masterclass Pass, **new email** | Account created, password form, welcome email | Password set on `/welcome`, landed on the dashboard, welcome email arrived; pass to 2027-09-28 | Pass |
| 3 | **Renewal** (first ever), term moved to end in 10 days | $100 (⅔ of $150); expiry +1 year from the old end; count 1; `is_renewal` | $100.00; 2026-10-08 → **2027-10-08**; count 1; `is_renewal = true` | Pass |
| 4 | **Second renewal**, term moved to end in 10 days again | $50 (⅓, the floor); count 2; one "access is renewed" receipt | $50.00; expiry **2027-10-08**; count 2; receipt arrived, `receipt_sent_at` claimed once | Pass |
| 5a | **Ended, within grace** (expired 5 days ago) | Content locked; banner keeps her $50 price until the grace end | Colorimetry locked; banner offers $50 | Pass |
| 5b | **Lapsed** (expired 31 days ago), then buy the pass again from `/vault-access` while signed in | Banner: price reset, link to buy; $150; count reset to 0; expiry a year from today; one "purchase confirmed" receipt | Banner's "See the current price" went to the **signup form**. Bought at $150: count **0**, expiry **2027-09-28**, receipt arrived. But the checkout was the **guest** flow: email typed into Stripe, return to `/welcome` saying "sign in". | Fixed (below) |
| 6 | Re-run of 5b after the fix: signed in, start checkout from `/vault-access`, then cancel | Checkout attached to her account, email prefilled, success back to the Vault | Session `cs_test_a1wi8…`: `client_reference_id` = her id, `customer_email` prefilled, `success_url` `/vault?checkout_success=true`; left unpaid (she already held the pass) | Pass |
| 7 | **Refund** of journey 1's $150 through the Stripe API | `charge.refunded` reaches the webhook; "Refund issued" admin alert; access kept | Alert within seconds (the first time it has ever fired); the account kept its pass | Pass |
| 8 | **Cleanup**: all three rehearsal accounts deleted through the app (Profile → Delete Account) | Purchases and fulfilments kept, detached; no grants; check OK | 12 purchases and 20 fulfilments kept, **0 attached**; 0 grants; 0 orphaned profiles; 0 open claims; `check_fulfillments.mjs` `OK` | Pass |

**Not run live: Restore.** Its button only shows on a locked masterclass, and
every rehearsal account had access. Its guards (skip refunded or disputed
charges; never hand a deleted account's purchase to a new account with the
same email) are covered on the real schema by
`tests/integration/fulfillment.test.ts`.

## Defects found and fixed

Each with a test that failed against the old code, then deployed and, where
it is visible on the site, re-checked live.

1. **Profile pointed at `/vault/join` after a password login** (`fdedfdd`).
   Reproduced on the live site with Playwright on every password login, not
   only after `/welcome`. `/vault/join` is public, shares the Vault layout and
   is linked from the login and sales pages, so production prefetched a
   signed-out render of that layout and the client-side push after sign-in
   reused it. Every browser-side sign-in and sign-out now does a full page
   load (`app/lib/after-auth-change.ts`). Re-run live after deploy: Profile →
   `/en/vault/profile` on both paths.
2. **`/welcome` promised an existing member an email that is never sent**
   (`4c174ea`). Shown now only when one was or will be sent. Checked live.
3. **Test webhooks not subscribed to refund/dispute events** (`39cfd7b`,
   Stripe API). See Setup.
4. **An existing member who paid got no email at all.** Owner decision: a
   branded receipt, EN/ES, for every checkout that does not get the welcome,
   sent exactly once however Stripe delivers (migration 34,
   `tests/integration/purchase-receipt.test.ts`).

5. **A signed-in member buying from `/vault-access` went through the guest
   checkout.** The prerendered page hard-coded `isSignedIn={false}` ("a member
   never sees this page", untrue since the page got its own address), so her
   purchase was matched by the email she typed into Stripe: a different
   address would have sent it to another, or a brand-new, account. The
   checkout is now chosen at click time by a server action from the session
   cookie (`createSalesPageCheckout`, `tests/unit/sales-page-checkout.test.tsx`).
6. **Two sales-path links led a member to the signup form.** The lapsed
   banner's "See the current price" now goes to `/vault-access`
   (`tests/unit/renew-access-banner.test.tsx`), and the sales page's closing
   "Get access" goes to its own offer section, like the hero's.

## Closed afterwards, same day

- **The sales page sold a member what she already held** (the owner noticed
  it at journey 6). Checkout now asks `alreadyHolds` (`app/lib/already-owned.ts`)
  before opening Stripe, by the Vault's own rule: live term, `check_access`
  for content, Full Access covers the passes, services never count, admins
  are never refused. The button says it is already hers, with a link in.
  `tests/integration/already-owned.test.ts` (5 of 12 failed first; removing
  the term check or the admin exemption each fails one).
- **"Log in as a guest" showed to signed-in members**, and clicking it
  swapped her session for an anonymous one (an anonymous account appeared
  during cleanup at 18:45 UTC, probably from it; it holds nothing). It now
  shows only to someone with no session (`app/lib/use-session-kind.ts`).
- **Returning clients had no way to sign in from the page** (owner request).
  A "Sign in" link in the navbar (desktop and mobile menu) and under the hero
  buttons; it reads "Go to the Vault" for a member already signed in.
  `tests/unit/sales-page-session.test.tsx`.

## Using this as the cutover smoke test

After the Stripe live cutover (owner action 1), with a real card and a real
product: run journeys 1 or 2 (a guest purchase), 6 without cancelling (a
signed-in purchase), and 7 (refund it), then `check_fulfillments.mjs`. That
exercises both checkout flows, both purchase emails, the refund alert and
the fulfilment record on live keys.
