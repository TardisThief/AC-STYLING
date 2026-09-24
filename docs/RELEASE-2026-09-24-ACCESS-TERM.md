# Release: the one-year access term and the thirds ladder

Status: **migration 21 applied and verified in production; application code
committed and pushed, not yet deployed.**
See the [roadmap](../ROADMAP.md) and
[migration 21](../supabase/migrations/20260924_21_access_term.sql).

## What changed

Vault access stops being perpetual. A purchase now grants one year, and renewal
steps down in thirds — year one at the price paid, year two at two thirds of it,
year three and every year after at one third. A lapse of more than thirty days
returns the buyer to the current list price at the bottom rung; those thirty days
hold the *price*, not the access, which ends on the expiry date.

Shipped alongside it, because they touch the same page and the same copy:
individual masterclasses are sellable from `/vault-access`, and `price_display`,
`is_published` and `runtime_minutes` became editable in the masterclass admin
form.

Application commits, on `main`:

| Commit | |
|---|---|
| `f5fbc29` | Send the guest to checkout instead of a dead end |
| `c02f03d` | Let the recognitions land one at a time |
| `a3327b2` | Sell a year of the Vault, and a masterclass on its own |

Each typechecks standalone. `a3327b2` is the one that must not be deployed
without migration 21 — see [Ordering](#ordering).

## Execution record

- Pre-migration snapshot: `backups/pre-migration-21--2026-09-24T223618Z`,
  0.4 MB, 28 public tables, `auth=full`, sha256
  `ae0065372fb29533c3ebd74042a93ac42b8eab2366508d72c37e4e6588959101`. Local
  only; hermes holds the off-site copies.
- Dry run: the whole file executed in a transaction ending in `ROLLBACK`, clean.
- Applied transactionally by the agent at **2026-09-24 22:43:21 UTC**.
- SHA-256 of the file **as applied**:
  `3c4544a3f654b500c004a5b199bbc567c099f474795336baa1222fad1aea0de8`.
- SHA-256 of the file **as committed**:
  `845f76f0e69fded918055eab1d32b127200cf2003de1328d9c0bed8afe16587d`. The two
  differ by one deliberate edit made *after* applying: the `DO` guard checks
  "already applied" before it checks the migration-19 shape. On a re-run the
  original order reported drift — this migration rewrites the very clauses the
  shape check looks for — which would have sent the next reader to investigate a
  function that was simply already correct. No executable statement changed, and
  re-running the committed file against production raises
  `check_access() already carries the access term; migration 21 has been applied`.

### Verification, run live and rolled back

Structural: all five columns present with the intended types, nullability and
defaults; `access_expires_at` and `access_renewal_count` carry no `INSERT` or
`UPDATE` grant for `anon`, `authenticated` or `PUBLIC`;
`purchases_user_product_original_idx` exists.

Behavioural, against `check_access()` with fixture profiles:

| Case | Expected | Result |
|---|---|---|
| Pass, expiry 100 days out | opens | ✅ |
| Pass, expiry 1 day past | refuses | ✅ |
| Pass, expiry `NULL` (bought before the term) | opens | ✅ |
| Admin, expiry 400 days past | opens | ✅ |
| Single grant, expired — direct | refuses | ✅ |
| Single grant, expired — inherited by a module | refuses | ✅ |
| Same grant, 30 days left — direct and inherited | opens | ✅ |

And the one that matters most for existing customers: **0 real profiles carry an
expiry.** There is no backfill, `NULL` means never, and nobody who has already
bought lost anything.

Gates at the time of the release: 571 unit tests across 55 files, lint 0 errors,
`tsc` clean, production build passing with `/vault-access` still statically
prerendered.

## Ordering

The migration is applied and the code is not deployed. That gap is in the safe
direction: production still grants perpetual access, exactly as before, and the
new columns sit unused.

**The reverse would break every purchase.** `setProfileFlag` writes
`access_expires_at`, so application code deployed against a database without
migration 21 raises `GrantWriteError` on every fulfilment — the webhook returns
500, Stripe retries, and the buyer is charged with nothing granted. Deploy only
against a database that has migration 21.

## Not covered by this record

- **The renewal flow has never run.** `createRenewalCheckoutSession` and
  `RenewAccessBanner` are unit-tested; no Stripe session has ever been created
  from them, and the banner has never rendered in a browser. It involves money
  and it is untested end to end.
- **The baseline snapshot is not updated.**
  `supabase/migrations/00000000000000_baseline.sql` still describes the schema as
  of 2026-07-10 and predates migrations 09–21. It was already stale before this
  work; see the roadmap.
- The thirty-day grace is enforced in application code
  (`app/lib/entitlement-period.ts`), not in `check_access()`. A direct database
  client sees only the expiry, which is correct — grace was never about access.
