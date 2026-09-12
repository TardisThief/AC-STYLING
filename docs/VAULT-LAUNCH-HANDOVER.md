# The Vault sales page — handover

Branch merged to `main` and deployed. Live at `/vault` in both locales,
shipping `noindex` until you flip it.

## What was built

**The page.** The public, bilingual, statically prerendered sales page lives at
**`/vault-access`** — this is the URL for the Instagram bio. Thirteen sections:
hero, recognition, method, placement (the colour field), catalogue, flagship
curriculum, what's included, Alejandra, proof, offer, bridge to 1:1, FAQ, close
— plus a mobile sticky CTA.

**Addresses.** `/vault` is members-only and redirects anonymous visitors to
`/vault-access`. `/vault-landing` (an old internal route) and `/vault/gallery`
(deleted) both fold forward. Because the sales page has its own address, it
looks the same to everyone — including Alejandra while she is signed in.

**After payment.** Stripe returns to `/[locale]/welcome`, which verifies the
session server-side and offers a set-password form, with the emailed recovery
link still sent as a fallback. The session id in that URL is a weak credential,
so the claim is fenced four ways: the session must be genuinely paid, under 24h
old, rate limited per email, and the account must still carry
`pending_password` — a flag set only when the webhook creates a guest account
and cleared the moment a password is set. An established account can never be
touched this way.

**Everything on the page comes from the database.** Course titles, subtitles,
descriptions, module lists, takeaways, runtimes and prices are read at build
time through a cookieless cached client (`app/lib/vault-catalog.ts`). Editing a
course in the admin changes the page. Nothing about a course is written into
JSX.

**Backend.** Publication flags and catalogue metadata (migration 10), chapter
video ids gated behind entitlement (09), a founding-cohort record on every
offer purchase (11), pay-before-signup checkout, Vercel Analytics with
section-level CTA attribution, and app-wide SEO scaffolding (sitemap, robots,
canonical + hreflang, per-locale OG image, Course and FAQPage JSON-LD).

## What was assumed

- **The repo's palette and typefaces win.** The brief supplied Lora, Poppins and
  a `#42332B` palette from an older brand document; none of it is in the code.
  The page is built on the existing tokens and Antic Didone / Inter. **Which
  identity AC Styling actually uses is still an open question and it is
  Alejandra's to settle** — it should not be resolved by one page shipping in a
  second voice.
- **"Recorded in both Spanish and English" is a promise, not yet a fact.** Every
  Colorimetría module still has `TODO_FILL_IN` in both language slots. The page
  is noindex so nothing is publicly claimed yet, but if the English recordings
  are not done when you flip the flag, that line changes before the flag does.
- **The price is stated and left alone.** No "price rises soon" line anywhere:
  with no mechanism, date or count behind it, any such sentence is urgency, and
  the brief rules urgency out. There is a drafted line and a named slot
  (`offer.priceNote`) if you want it.
- **The anchor is the 1:1 comparison only** ($250 Closet Detox, $500 styling
  session — both real figures from the database). A sum-of-singles anchor needs
  prices on the other three masterclasses.

## What still needs Alejandra

1. **Real student results.** The single remaining `TODO_STUDENT_RESULTS`. The
   slot renders nothing in production, so the page ships honestly on the two
   named testimonials and the client roster until she supplies real ones. No
   enrollment counts, ratings or completion figures exist anywhere in the
   database — none may be invented.
2. **Module video.** Colorimetría's five modules have no playable video.
3. **Service copy.** `services.description` still holds "EXPLANATION" and
   "TEST TEST TEST", and neither service has Spanish.
4. **A native read of both locales** before the page is promoted.

## What still needs you

- **Stripe live mode.** Test keys locally; the catalogue holds 17 active
  products including `TestTedt`, `Add for DB Hold`, two Closet Detox entries and
  orphans no database row references. Establish the canonical live products and
  repoint `price_id` / `stripe_product_id`.
- **Vimeo domain-restricted playback** for theacstyle.com.
- **Enable Web Analytics** in the Vercel dashboard, then set
  `NEXT_PUBLIC_VERCEL_ANALYTICS=true`. Until then the script is not loaded at
  all (it would 404 and log a console error on every page).
- **Flip to indexed** when video and Stripe are real: set `VAULT_INDEXABLE=true`
  and add `/vault-access` to `app/sitemap.ts`. Both are governed together so
  they cannot drift.
- Optionally `VAULT_REVEAL_UPCOMING=true` to show in-production courses as
  "included with Full Access" cards.

## Measured state

Lighthouse mobile against production, median of three clean runs:

Measured at `/vault` before the URL split; the page itself is unchanged.

| | EN | target |
|---|---|---|
| Accessibility | **100** | ≥95 ✅ |
| Best practices | **100** | — ✅ |
| SEO | 69 | 100 ⚠️ |
| Performance | 81 | ≥90 ❌ |

- **SEO 69 is the noindex, and only the noindex.** `is-crawlable` is the single
  failing audit; every other SEO check passes. It becomes 100 when the flag
  flips.
- **Performance 81 misses the target.** CLS is 0 and FCP is 1.4s; the cost is
  LCP 3.3s, of which 43% is render delay, and ~1.5s of script evaluation with
  50KB of unused JavaScript. The cause is not this page's own code — it is
  **framer-motion in the shared `Navbar` and `TrustedByCarousel`**, which ten
  components import. Removing it from the shared chrome is the one change that
  moves this number, and it touches the marketing home page too, so it is a
  deliberate decision rather than something to slip in at the end of this work.

## Not done, deliberately

- `lab_questions` and `resource_urls` on `chapters` are still anonymously
  readable — the same class of leak as the video ids that migration 09 closed.
  Left alone because the Essence Lab quiz is the candidate lead magnet and may
  become public on purpose. Four lines in the same migration when you decide.
- The marketing home page's `Hero` preloads both crops on every device, the same
  defect fixed on the Vault hero. Same one-line fix, different page.
