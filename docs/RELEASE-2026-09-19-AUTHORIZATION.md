# Authorization release: F01-F04 and framework patch

Status: implemented locally; production deployment and SQL application pending.
See the [roadmap](../ROADMAP.md). The detailed assessment is retained in the owner's working copy.

## Dependencies checked

- Direct read-only access to the shared production database works. The assessment
  captured 26 public tables, 72 public/storage policies, function definitions,
  column grants, triggers, constraints, and bucket configuration.
- Profile INSERT/UPDATE grants currently permit self-escalation. Migration 12
  removes table and column grants, then allows only ordinary self-profile fields.
  Existing RLS still controls which rows may be edited.
- `toggleStudioAccess`, `updateProfileStatus`, and purchase restoration require
  trusted server writes after the revoke. The first two verify the acting admin;
  restoration verifies the signed-in email and paid Stripe session ownership.
  `TailorCard` now calls the admin action. Signup's definer trigger, onboarding,
  claim, wardrobe assignment, and webhook flows already use privileged writes.
- No application callers use the two legacy clone RPCs. Rate-limit calls already
  use the service role. Their browser execution grants can be revoked together.
- Boutique writes and Vault signed upload URL creation already verify admins.
  No avatar uploader is present. Future avatar uploads must use an owner-ID folder.
- Existing real storage uploads are JPEG/PNG and below 5 MB. Migration 12 caps
  new files at 15 MB, permits raster images, and also permits PDF/ZIP in Vault.
  It leaves existing objects and wardrobe bucket privacy intact. SVG/HTML and
  other formats are intentionally excluded; test rejected files through Storage.
- Next and eslint-config-next are aligned at 16.3.5. Local Node 20.19.4 satisfies
  the package's >=20.9 requirement. Existing React 19.2.3 is within peer requirements.
- Translation/legal edits belong to the other agent and are outside this change.

## Release sequence

1. Review the application changes and migration 12 together. Complete local
   tests, lint, TypeScript checks, and build before deployment.
2. Deploy the coordinated application changes **before** applying SQL. Confirm
   the production service-role environment is configured and server-only. Smoke
   test an authorized admin changing a client's status and Studio access.
3. The executing agent reviews and applies
   `supabase/migrations/20260919_12_authorization_boundaries.sql` through the
   authenticated PostgreSQL connection, following the [migration policy](../supabase/migrations/README.md).
   This is production, not a staging DB. The migration is transactional with
   lock and statement timeouts; it does not delete customer data or files.
4. Run `node scripts/verify_authorization.mjs` with the production DATABASE_URL.
   It uses a read-only transaction and prints only structural check results.
   Check the complete permissive policy inventory for unexpected additional
   policies, since PostgreSQL combines permissive policies with OR.
5. Smoke test ordinary self-profile edits; denied role/paid-flag changes; admin
   status/access changes; boutique collection editing; anonymous boutique reads;
   click attribution; admin image/PDF uploads; rejected SVG/HTML/oversize uploads;
   existing wardrobe signed images; and signup with a test account. Have the
   owner review existing privileged accounts/grants: closing write access does
   not reverse any earlier unauthorized changes.
6. Record deployment identity, SQL application time, verifier output, and smoke
   results in the roadmap. Until then, the live findings remain open.

If the SQL transaction fails, it rolls back as a unit. Keep the compatible new
application deployed while investigating. After successful SQL application,
prefer fixing forward: restoring the old broad grants reopens the escalation.
Do not roll the application back independently of these database dependencies.

## Validation scope and remaining work

Local results: 38 test files / 320 tests pass, including 31 PostgreSQL permission
tests and 10 new server-action authorization tests. Lint passes with 0 errors and
159 pre-existing warnings. The Next 16.3.5 production build and its TypeScript
checks pass; the existing `metadataBase` fallback warning remains. The read-only
production verifier reports 12 failed
checks and preserved wardrobe privacy before application, confirming these
live fixes are still pending.

The integration fixture reproduces the affected live grants/policies/functions
with synthetic identities. It first proves the original self-role escalation,
then runs migration 12 in PGlite's PostgreSQL engine and tests the resulting
permissions. It does not start Supabase Auth, PostgREST, or the Storage HTTP
service; bucket MIME/size enforcement and signed uploads still need release
smoke tests. CI runs these tests without production credentials or Docker.

F05-F07 remain next: reliable payment replay, claim/password lifecycle, and
redirect/DNS-safe image fetching. Purchase restoration still scans only 100
sessions, and the shared grant helper still needs reliable error propagation.
The live purchase trigger also compares `services.price_id` against a purchase
product ID; reconcile that identifier mismatch in the fulfillment work.

The refreshed npm audit retains four high findings in Puppeteer's transitive
`extract-zip` chain. The suggested force fix downgrades Puppeteer to 19.8.0 and
was not applied. Resolve the browser acquisition/extraction dependency alongside
the scraper work; do not label the dependency audit clean.

Live Vercel configuration/deployment identity, Vimeo restrictions, email
delivery, and backup restoration have not been verified. This release addresses
authorization dependencies, not complete commercial launch readiness.
