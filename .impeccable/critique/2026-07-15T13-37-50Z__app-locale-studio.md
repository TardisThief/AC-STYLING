---
target: The Studio (wardrobe management)
total_score: 18
p0_count: 0
p1_count: 4
timestamp: 2026-07-15T13-37-50Z
slug: app-locale-studio
---
⚠️ DEGRADED: single-context (harness policy forbids spawning sub-agents unless the user asks; Assessment A was completed and recorded before the detector was run)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Toasts + spinners are solid, but `ClientStudioDashboard` shows hardcoded "Last Active: Today"; clone reports success on a write that lands in the wrong wardrobe |
| 2 | Match System / Real World | 2 | "Curation Ingestion" as a modal title; sidebar says "Wardrobes" while its empty state says "Select a client"; three note fields (`client_note`/`internal_note`/`notes`) with overlapping names |
| 3 | User Control and Freedom | 2 | No Esc, no focus trap on 5 hand-rolled modals; no undo on permanent delete |
| 4 | Consistency and Standards | 1 | 5 duplicated modal implementations; native `confirm()` beside styled `sonner` toasts; two parallel intake stacks; upload writes `notes` where boutique import writes `internal_note` |
| 5 | Error Prevention | 2 | `confirm()` guards deletes, but file inputs have no `accept`/size limit and an invalid token renders a welcoming signup page |
| 6 | Recognition Rather Than Recall | 2 | Tab labels are `hidden sm:inline` → icon-only on mobile with no accessible name; icon buttons use `title` not `aria-label`; 9 filter chips at one decision point |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, no multi-select, no bulk status tagging — items are curated strictly one at a time |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely handsome and on-brand; glass is applied as a default surface rather than a deliberate one |
| 9 | Error Recovery | 2 | "Failed to update item" names the problem but never the fix; no retry affordance on the main data paths |
| 10 | Help and Documentation | 1 | None. No contextual help, no teaching empty states |
| **Total** | | **18/40** | **Poor — major UX work needed, though concentrated in a few fixable systems** |

## Anti-Patterns Verdict

**LLM assessment**: This does **not** read as AI-generated. The visual layer is the strongest part of the Studio — a committed taupe/gold/olive palette, restrained type, and a genuinely considered two-pane curation workspace (grid + sticky detail panel) that fits how a stylist actually works. It doesn't look like a template.

The failure isn't slop, it's the product register's real failure mode: **strangeness without purpose**, and a system that has drifted out of sync with itself. Five modals were hand-built five times. Native `confirm()` sits beside a styled toast system. Two complete intake flows exist and only one can run. That's not a design that was generated; it's a design that was iterated past its own seams.

Glassmorphism is heavy (`bg-white/40 backdrop-blur-md` as the default panel), which the shared bans flag as a default-decoration tell. Here it's identity — "Liquid Glass & Taupe" is the documented design system — so identity preservation wins and I'm not calling it slop. It is worth asking whether glass should mark *interactive/elevated* surfaces rather than every panel.

**Deterministic scan**: `detect.mjs` ran cleanly (exit 0) and returned `[]` for `components/studio` and `app/[locale]/studio`. **This is not a clean bill of health.** It also returned `[]` for all of `components/`, and produced no output whatsoever for both a `.tsx` and a `.css` file — including files with known glass/eyebrow patterns. It's an HTML/CSS-oriented scanner with nothing scannable in a Next.js + Tailwind v4 tree. Treat the deterministic signal as **unavailable**, not as passing.

**Visual overlays**: Not available. No user-visible overlay was injected. The two primary Studio surfaces are gated (`/vault/studio` requires `role='admin'`, `/vault/my-studio` requires `active_studio_client`), and reaching them would require granting privileges in the production database — the user owns DB changes. The token surfaces are worse: `IntakeLanding` fires `activateStudioAccess(token)` from a mount effect, so loading a real invitation link would **consume** it. Browser evidence is therefore limited to gate behavior, verified below.

## Overall Impression

The Studio is the most capable and least maintained surface in the app. The workspace concept is right and the craft in the item-curation panel is real. But it's the one major surface that never received the a11y and consistency passes the Vault and landing page got, and it shows: **zero `aria-*` attributes and zero `role=` across all 13 components and 4,078 lines.**

The single biggest opportunity: **delete the dead intake stack, then fix the client-facing surface.** Roughly 1,000 lines of the Studio can't execute, and the part clients actually see is showing them fabricated information.

## What's Working

1. **The curation workspace composition.** `VirtualWardrobe`'s grid + `lg:sticky` detail panel is the correct shape for the task — you keep context while working an item, no modal round-trip. The status summary (Keep/Tailor/Donate/Archive counts) plus the "N items not yet reviewed" line gives a real sense of progress through a wardrobe.
2. **The live upload path is properly engineered.** `/studio/upload/[token]` validates via `getWardrobeByToken` and redirects on failure; `WardrobeUploadLanding` mints a signed URL and PUTs bytes straight to storage, correctly bypassing Vercel's 4.5 MB body cap. This is the flow clients use and it's solid.
3. **Dual-note privacy model.** Separating the client's note from Ale's private note, and rendering the stylist note read-only in client view, is a thoughtful domain decision that respects the actual relationship.

## Priority Issues

### [P1] The client-facing dashboard shows fabricated data
`ClientStudioDashboard.tsx:129-134` hardcodes both strings in JSX:
```jsx
<p>Your stylist is currently curating new items for your review. Check back soon for updates.</p>
<div>Last Active: Today</div>
```
**Why it matters**: Every client sees "Last Active: Today" and "currently curating" forever, whether Ale opened their wardrobe this morning or never. This is the paid Studio surface — invented activity signals are a trust problem, not a copy problem. A client who notices will reasonably wonder what else is decorative.
**Fix**: Derive from real data (`wardrobe.updated_at`, or the newest `wardrobe_items.created_at`), or delete the panel. Don't ship a placeholder that asserts a fact.
**Suggested command**: `/impeccable clarify`

### [P1] "Clone to another client" writes to the wrong wardrobe and reports success
`VirtualWardrobe.tsx:122-131`:
```js
const { id, created_at, user_id, ...itemToClone } = selectedItem;  // wardrobe_id NOT excluded
await supabase.from('wardrobe_items').insert({ ...itemToClone, user_id: targetClient, ... });
```
`wardrobe_id` survives the rest-spread, so the clone is inserted into the **source** wardrobe carrying a foreign `user_id` — exactly the `user_id`-vs-`wardrobe_id` confusion the P1b normalization set out to eliminate. It then toasts `"Item cloned to X's wardrobe!"`. The target client gets nothing; the source wardrobe silently grows a duplicate. Even if it landed correctly, `image_url` points at the original owner's storage path, which owner-or-admin RLS won't sign for the recipient.
**Why it matters**: A feature that appears to work and produces a wrong result is worse than one that errors. It also quietly re-introduces the data-shape bug the last phase paid down.
**Fix**: Target a **wardrobe**, not a profile (`allClients` currently queries `profiles`). Exclude `wardrobe_id`/`updated_at`, set the destination explicitly, and copy the storage object into the destination's path via `wardrobeUploadPath`.
**Suggested command**: `/impeccable harden`

### [P1] Zero accessibility affordances across the entire surface
Grep for `aria-` or `role=` across all 13 Studio components: **no matches.** Concretely: wardrobe item cards are `<div onClick>` (not focusable, not keyboard-activatable); 5 modals have no `role="dialog"`, no `aria-modal`, no focus trap, no Esc; tab labels are `hidden sm:inline` so mobile tabs are unlabeled icons; icon-only buttons use `title` instead of `aria-label`; item images use `alt=""` though the image *is* the content.
**Why it matters**: The primary action — select an item and curate it — is **impossible without a mouse**. This isn't degraded, it's unavailable. The Vault got this pass; the Studio didn't.
**Fix**: Cards → `<button>`. Modals → shared component with `role="dialog"`, `aria-modal`, focus trap, Esc. Tabs → `role="tablist"`/`aria-selected`, keep an accessible name at every breakpoint. Icon buttons → `aria-label`.
**Suggested command**: `/impeccable audit`

### [P1] An entire dead intake stack is publicly routable and impersonates a real invitation
`/studio/intake/not-a-real-token` returns **200** and renders "Welcome, Style Icon." with a *Join the Studio* CTA — verified in the browser. The page's own comments concede it: *"we might show a 'Invalid Link' state… we'll assume the link is valid if it exists"*, and the destructured `error` is never read.

It cannot ever work: the chain (page → `IntakeLanding` → `IntakeUploader` → `app/actions/intake.ts` → `findInviteProfile` → `profiles.intake_token`) terminates in a column that **no row in the production database populates** (verified). Nothing in the codebase links to `/studio/intake` — zero references. The live flow is `InvitationGenerator` → `generateInvitation` → `/studio/upload/{upload_token}`.
**Why it matters**: Any invented string yields a page that looks like a genuine invitation from the brand — a phishing-shaped surface Ale doesn't know she's hosting. And ~1,000 lines of duplicate stack invite future edits to the wrong flow (the P1b guest-upload work already partly landed here).
**Fix**: Delete the route, `IntakeLanding`, `IntakeUploader`, `app/actions/intake.ts`, `app/lib/validation/intake.ts`. Keep `intake_token` itself — `activateStudioAccess`/auth-callback still use it to bind a token to a real user. Also delete `ClientSwitcher.tsx` (zero mount points).
**Suggested command**: `/impeccable distill`

### [P2] Five hand-rolled modals and native `confirm()` fracture the component vocabulary
`StudioDashboard` alone rebuilds the same `AnimatePresence` + `fixed inset-0 z-[100]` + backdrop three times; `VirtualWardrobe` and `ClientStudioDashboard` add two more. Alongside them sit 5 native `confirm()` calls (`ArchiveManager:59`, `DigitalLookbook:149`, `StudioDashboard:268`, `UserAssignmentModal:45`, `VirtualWardrobe:101`) — including *permanent, irreversible* deletion. `z-50`/`z-[100]` are arbitrary rather than a semantic scale.
**Why it matters**: Native `confirm()` is unstyled, unbrandable, blocks the main thread, and is suppressible — a luxury product asking "Are you sure?" in a raw Chrome dialog breaks the spell at the exact moment trust matters most. Five modal copies means the a11y fix above has to be made five times.
**Fix**: One `<Modal>` (dialog semantics, focus trap, Esc) and one `<ConfirmDialog>`; migrate all five sites. Add a `z-index` scale to the Tailwind theme.
**Suggested command**: `/impeccable extract`

## Persona Red Flags

**Sam (Accessibility-Dependent)** — Blocked entirely. Tabs to `/vault/my-studio`, reaches the wardrobe grid, and stops: every item card is a `<div onClick>` with no `tabIndex`, no `role`, no key handler, so the core action is unreachable. Screen reader announces the grid as a wall of unlabeled images (`alt=""`). If a modal somehow opens, focus stays behind it, Esc does nothing, and nothing announces it opened. On mobile the tab bar is three unlabeled icons. Zero `aria-*` in 4,078 lines — this surface was never built for Sam.

**Alex (Impatient Power User)** — Ale *is* Alex; this is her daily tool. To triage a 60-item wardrobe she must click each item, wait for the detail panel to animate in, click a status chip, then click the next — 60 times, no multi-select, no bulk tag, no keyboard shortcut, no arrow-key navigation between items. Every destructive action interrupts her with a native `confirm()`. The one accelerator on offer — Clone — writes to the wrong wardrobe and tells her it worked.

**Riley (Stress Tester)** — Has a field day. Invents a token → gets a warm, branded invitation page. Clones an item to another client → success toast, item never arrives, a duplicate appears in the current wardrobe instead. Types an internal note during boutique import → text is stored to `internal_note`, which no view renders, so it's write-only. Opens the add-item modal, hits Esc → nothing. Refreshes mid-upload → staged files gone, no recovery.

## Minor Observations

- **`internal_note` is write-only.** Written at `VirtualWardrobe.tsx:126` and `:531`; rendered nowhere. The detail panel shows only `client_note` and `notes`. Meanwhile the upload modal's field labeled "Internal Notes" writes to `notes`, which the detail panel labels "Ale's Private Note". Three columns, overlapping names, one invisible.
- **`IntakeLanding.tsx:26`**: `const mounted = true;` — a vestigial unmount guard, never reassigned, with no cleanup returned. Every `if (mounted)` is unconditionally true.
- **`StudioDashboard.tsx:40`**: `const supabase = createClient();` is created and never used. `useEffect` and `ChevronRight` are imported unused.
- **`VirtualWardrobe.tsx:559`**: `URL.createObjectURL(uploadFile)` called during render — a new blob URL each render, none revoked. Leaks.
- **`intake/[token]/page.tsx:12`**: `const t = await getTranslations(...)` never used; `// 2. Check if already converted` is duplicated verbatim.
- **File inputs have no `accept` or size guard**, so a 40 MB HEIC is staged, then fails at the storage boundary rather than at selection.
- **Loading is a bare string** (`"Loading Wardrobe..."`) where the product register asks for skeletons over spinners-in-content.
- **17 raw `<img>` tags** across the Studio, against CLAUDE.md's `SafeImage` convention — so a dead URL renders a broken-image glyph instead of the fallback.
- **Both gated pages re-fetch `getUser` + `profiles` inline** rather than using the `getViewer()` cache from the Vault perf work, and duplicate the `requireAdmin` check by hand. Relevant to Phase 3's caching item.
- **Empty state says "Select a client to begin styling"** while the sidebar it points at is titled "Wardrobes" — and a wardrobe may have no client assigned at all.

## Questions to Consider

- **Who is `/vault/studio` actually for?** It's Ale's daily instrument and nobody else's. Built for one expert, it should look less like a generic admin panel and more like a cockpit — keyboard-first, dense, bulk-capable. What would the version that assumes total fluency look like?
- **What if glass marked elevation instead of everything?** Right now every panel is `bg-white/40 backdrop-blur-md`, so glass carries no information. If only interactive/elevated surfaces were glass, the material would say something.
- **Is "Curation Ingestion" a voice, or a leak?** It's Ale's internal vocabulary showing through in a UI title. Confident, or just untranslated?
- **Should the client dashboard say less?** Cutting the fake status panel leaves a smaller, more honest page. What if it showed one true thing — "12 items awaiting Ale's review" — instead of three invented ones?
