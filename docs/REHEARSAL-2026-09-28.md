# Paid-path rehearsal — 2026-09-28

The first end-to-end run of every money path on the live site
(`www.theacstyle.com`), in Stripe **test mode**, before a real customer runs
any of it. The owner clicked; the agent checked the database, the emails and
the logs after each step, and fixed what broke.

**Status: in progress.** Steps 1–3 done; the ⅓ renewal step, lapse reset,
refund, Restore and cleanup are next.

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

## Still to run

- ⅓ renewal step (renew again: expect $50).
- Lapse: move the expiry more than 30 days into the past; the quote should
  reset to the current price.
- Refund one test charge: admin "Refund issued" alert, access not revoked.
- Restore: a new account with a guest buyer's email gets the unrefunded
  purchase and not the refunded one.
- A receipt arrives for a signed-in purchase and for a renewal.
- Cleanup: delete the three accounts in the app; purchases and fulfilments
  stay, detached; `check_fulfillments.mjs` `OK`.
