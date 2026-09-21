# AC Styling — Engineering Roadmap

**Checkpoint: 2026-09-21.** The pre-content engineering push is closed. The
previous roadmap reached 749 lines and had started getting in the way of the
work; it is archived whole at
[`docs/archive/ROADMAP-2026-09-21.md`](docs/archive/ROADMAP-2026-09-21.md),
because the reasons recorded in it — especially why several things were
deliberately *not* done — outlast the task lists.

This file is deliberately short. **The next plan has not been written yet**;
see [Next planning session](#next-planning-session) at the bottom.

---

## Where the platform stands

Phases 0–3.6 are complete and deployed. In plain terms:

- **The code is launch-ready.** Every code-level blocker from the 2026-09-19
  assessment (F01–F08, F10, F11) is closed. Migrations are applied and verified
  through 19.
- **The Vault is populated but parked.** 4 masterclasses, 22 modules and 4
  standalone courses, all bilingual, all `is_published = false`. Publishing is
  a flag flip in the admin console, not a re-import.
- **Launch offer is the Masterclass Pass** (2026-09-21, migration 19): every
  masterclass, current and future, for one payment, alongside single
  masterclasses. Full Access and the Course Pass stay in the database but are
  switched off (`offers.active`) until the first standalone course ships; the
  sales page and Vault banner follow that switch with no code change.
- **Gates are green:** `tsc` clean, lint 0 errors, 531 unit tests across 52
  files, production build passing, CI running all four.

## What actually holds up launch

Two things, and neither is code.

1. **No module video.** Every `video_id` reads `pending_video`. This is F09 —
   content, not engineering. Nothing can be published until real Vimeo IDs
   exist.
2. **Stripe is in the test sandbox.** The 11 `stripe_product_id` and 9
   `price_id` values in the database are test-mode, and IDs do not carry across
   modes. A real customer would pay and match nothing. This is owner action 1.

Everything owner-only lives in [`docs/OWNER-ACTIONS.md`](docs/OWNER-ACTIONS.md)
— 12 items, kept there rather than here so that "what Claude does next" and
"what the owner does next" do not get shuffled together again.

## Parked, with reasons

Not abandoned. The full rationale is in the archive; the summary is that each
of these is cheaper or safer to do *after* content exists.

| | Why it waits |
|---|---|
| **Ops polish (CSP hardening)** | The policy is decorative today and the UI surface changes as content lands — exactly the churn that breaks a nonce policy. Harden once, against the settled surface. |
| **North-star features** (Style of the Week, Ale's Pick, boutique carousel) | These are editorial *surfaces* with no editorial content to put in them. Building them now means designing against placeholders. |
| **F12 — scale limits** | Guest resolution pages through at most 2,000 auth users. Real, invisible at 55 users, and it fires precisely when growth goes well. Belongs before a marketing push. |
| **F13 — E2E in CI** | The Playwright suite exists and is correct; wiring it into CI needs a test database, which is F16's dependency. |
| **F15 — ES parity and performance** | Best measured against real content and real copy. |
| **F16 — recovery and observability** | Staging database, rehearsed restore, alerting on paid-but-unfulfilled purchases. The largest item and the most dependent on hosting and budget decisions. |

## Next planning session

To be worked out after this checkpoint, deliberately not pre-decided here. The
open questions worth walking into it with:

- **Does content land before or after the Stripe cutover?** They are
  independent, and doing the cutover first means the first real publish is also
  the first real sale — worth deciding on purpose rather than by accident.
- **Which pillar launches first?** The archive records a masterclasses-first
  idea with the boutique and Style of the Week marked "coming soon". That is a
  positioning call for Ale, and it decides how much of the north-star set is
  even needed at launch.
- **`VAULT_REVEAL_UPCOMING` is on.** The catalogue currently shows as eight "In
  production" cards. That is a live marketing decision, not a technical one:
  quiet page, or visible pipeline.
- **What is the smallest publishable slice?** One masterclass with real video
  beats four parked ones, and it would exercise the whole paid path end to end
  for the first time with something real behind it.
- **F16 or growth first?** F16 is the responsible answer and F12 is the one
  that bites if launch goes well. Neither matters if nothing ships.

---

*History, rationale and the record of what was considered and rejected:
[`docs/archive/ROADMAP-2026-09-21.md`](docs/archive/ROADMAP-2026-09-21.md).
The underlying findings: [`docs/ASSESSMENT-2026-09-19.md`](docs/ASSESSMENT-2026-09-19.md).*
