# Product

Standing product truth for AC Styling: who it is for, what it claims, how it
speaks, and what may never be invented. This outlives any single piece of work —
when a page and this document disagree about the audience, the positioning, or a
brand commitment, this document is the one to argue with first.

## Platform

web

## Users

Two audiences, addressed by one surface and routed apart by intent:

- **The self-paced learner (primary).** A woman who wants to understand her own
  colouring and dress deliberately, and who would rather learn the method than
  hire someone. Buys without a conversation. Arrives overwhelmingly from
  Instagram, on a phone. Spanish-speaking LatAm is the composing audience; the
  English-speaking Miami professional is served at full parity.
- **The 1:1 client.** Wants the work done with her, not taught to her. Books an
  intro session rather than buying a course. Historically the higher-value
  relationship ($250-$500 engagements).

Both land on the same page. The page's job is to let each recognise herself and
take a different action, without either feeling like the consolation prize.

## Product Purpose

The Vault is AC Styling's education arm: self-paced masterclasses and courses
that teach personal style as a system rather than a set of trends. It is sold
publicly at `/vault-access`; `/vault` itself stays the members-only library.
Success for that surface is that a stranger understands what the Vault is, sees
herself in it, and buys — without talking to anyone — while an entitled customer
still lands in her library.

The standard is "the Vault is sellable", not "a page exists".

## Positioning

- **Enclothed cognition as the foundation.** The method rests on published
  research (Adam & Galinsky, Northwestern) that clothing changes the wearer's
  own cognition, not only how others read her. The claim is that style is
  communication and self-perception, not trend-chasing.
- **The honest 4 / 12 split.** Online courses teach the four colour seasons. The
  twelve sub-seasons are deliberately reserved for 1:1 analysis. This is a real
  product boundary, not a sales device: it is the reason the Vault and the
  personal service are complements rather than substitutes, and it is provable
  from the curriculum — module 4 of the flagship is literally "The 4 Color
  Seasons".
- Alejandra Carrillo is a working stylist with a real client roster, not a
  course creator. Studios in Miami, Bogotá and Madrid.

## Operating Context

- Traffic arrives from an Instagram bio link, mobile-first.
- Purchase is self-serve Stripe Checkout. 1:1 work is booked through Calendly
  (`calendly.com/fashionstylist-ac/30min`) via `/book`.
- Course video is hosted on Vimeo; playback is being restricted to
  theacstyle.com rather than merely unlisted.
- Content is authored by Alejandra in Spanish first, then adapted to English.
- Catalogue content is edited through the in-app admin, so the page must read
  the database and never hard-code course facts.

## Capabilities and Constraints

- **Built and working:** Stripe Checkout, a signature-verified webhook with an
  idempotency gate, entitlement resolution (`grantAccessForProduct`, the
  `check_access` RPC), bilingual content columns on every content table, RLS
  permitting anonymous catalogue reads, Resend transactional email.
- **Business model is hybrid:** per-masterclass purchase, plus pass offers.
  The **Masterclass Pass** (every masterclass, current and future) is the
  launch offer, decided 2026-09-21 (migration 19). `full_access` and
  `course_pass` stay in the database, switched off (`offers.active`), until
  the first standalone course ships; the sales page follows that switch.
- **Access term: one year, renewable** — decided 2026-09-24 (migration 21,
  [`docs/RELEASE-2026-09-24-ACCESS-TERM.md`](docs/RELEASE-2026-09-24-ACCESS-TERM.md)).
  Renewal steps down in thirds — the price paid, then two thirds, then one
  third — and a lapse of over thirty days resets it to the current price.
  Everyone who bought before that date keeps perpetual access (a null expiry).
  This replaces the earlier "lifetime (de por vida)" founding promise; no
  page may still make it. Price still rises as the library grows, with no
  mechanism, trigger, date, seat count or timer, and no future price named.
- **Pay-before-signup works.** Stripe collects the email, the webhook creates the
  account and sends a set-password link, and the buyer lands on `/welcome` to
  claim it. This replaced a path that returned 200 and silently lost the sale.
- **Stripe is deliberately in test mode pre-launch.** Establishing canonical
  live products and repointing the database is the owner's task.
- **The page ships `noindex` and unlisted** until module video is real and
  Stripe is live. Flipping to indexed is a deliberate act, not a merge
  side-effect.
- **Catalogue state is a snapshot, not the plan.** Four masterclasses and three
  standalone courses are the target set; content is in production now. Rows
  carry `is_published` and `available_at`; unpublished rows may appear as
  "in production" cards behind a reveal flag, and a date is shown only when one
  is actually set.
- No level or rating data exists. `runtime_minutes` (migration 10) is the
  runtime column and is null until authored.

## Brand Commitments

- **Name and voice:** AC Styling / theacstyle.com. Editorial, short, second
  person, no hype. Existing lines: "Style, Confidence, YOU." / "Where your style
  communicates your essence." / "Let your style do the talking."
- **Archetypes:** Explorador is the outward promise (expansion, discovery);
  Mago is the internal driver (transformation, method); Bufón is a tonal layer —
  lightness, a wink, never solemn, and used once or twice across a whole page,
  never as a voice.
- **Binding identity constraint:** the repository's own tokens and typefaces
  win over any external brand document. Two such documents have circulated —
  one specifying Lora/Poppins, and a generated `design-system/` file specifying
  Playfair Display on a blue CTA; the latter was deleted from the repo in
  September 2026 precisely because it contradicted the shipped tokens. Treat any
  brand doc that is not the code as reference material, never an instruction.
  Which identity AC Styling ultimately uses is an open question and is
  Alejandra's to settle — not something to resolve by shipping one page in a
  second voice.
- **Prohibited:** invented prices, testimonials, statistics, credentials,
  retail-value stacks, manufactured scarcity, countdowns. Any gap ships as a
  visible TODO.

## Evidence on Hand

Real, usable:

- **Flagship curriculum.** Colorimetría / Colorimetry, five modules, each with a
  substantive authored paragraph and 4-6 takeaways, in both languages, already
  in the database. The Spanish is native-quality.
- **Client roster**, 12 logos in `trusted_by_logos`: Balmain, Baobab, Andrés
  Otalora, Vyta, Sarth, Botango, Origen, Baúl, Koor, WellUp Collective, Girls
  Gone Social, BrandHIVE.
- **Two named testimonials** — Alexandra (Toronto) and Bianca (Caracas) — held
  as text in `messages/*.json`.
- **Photography:** seven studio shots of Alejandra in `public/`.
- **Three service catalogue PDFs** in `public/catalogs/`.
- **Real 1:1 prices:** Closet Detox $250, Personal Styling Session $500.

Absences that must never be fabricated:

- **No enrollment counts, completion rates, ratings or reviews exist.** The
  database holds two distinct learners, both test accounts, and no ratings
  table. Student results ship as visible TODO slots until Alejandra supplies
  real ones.
- A third testimonial (Manuel, Miami) is on the live site and has been pulled:
  he is the owner's own household and is a liability on a sales page.
- Service descriptions in the database are placeholder text ("EXPLANATION",
  "TEST TEST TEST") and have no Spanish.

## Product Principles

1. **Every claim traces to something real** — the database, the existing site,
   or the enclothed-cognition research. Anything unsourced ships as a visible
   TODO, never as plausible filler.
2. **The catalogue is generated, never transcribed.** Course facts come from the
   database or a single typed module, so the page cannot drift when Alejandra
   edits the catalogue.
3. **Route by intent, don't compare features.** A visitor should recognise her
   own situation and self-select; the 1:1 path is a real conversion, not a
   fallback.
4. **The 1:1 boundary is stated honestly**, because the honest version is also
   the more persuasive one.
5. **Never break the member.** An entitled customer who hits this route still
   reaches her library.

## Accessibility & Inclusion

- WCAG AA contrast. Sand tones in the `#D8BF9F` range fail for text and are
  background/accent only.
- Responsive to 360px; mobile is the majority path.
- Visible keyboard focus; `prefers-reduced-motion` respected.
- Full EN/ES parity, composed in Spanish and adapted to English — neutral
  Latin-American Spanish, no Peninsular voseo or Spain-only idiom.
