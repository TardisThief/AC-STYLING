#!/usr/bin/env bash
# Start (or stop) the local Supabase the browser tests run against.
#
#   bash scripts/ci/e2e-db.sh start   # build the schema, start, write .env.e2e
#   bash scripts/ci/e2e-db.sh stop
#
# Needs Docker. Never touches the production project: the database is
# built from supabase/migrations/00000000000000_baseline.sql and
# supabase/platform.sql (what lives outside `public`), then
# tests/e2e/db/supabase/seed.sql. The dated migrations are NOT replayed:
# they overlap the baseline (supabase/migrations/README.md), and their drift
# guards refuse to run twice.
set -euo pipefail

cd "$(dirname "$0")/../.."
SUPABASE="npx -y supabase@2.118.0"
WORKDIR=tests/e2e/db
MIGRATIONS="$WORKDIR/supabase/migrations"

case "${1:-start}" in
  start)
    rm -rf "$MIGRATIONS"
    mkdir -p "$MIGRATIONS"

    # Three edits to the dump, none touching the app's schema:
    #  - pg_dump 17's psql meta-commands (the "restrict" lines), which the
    #    Supabase migration runner cannot parse;
    #  - CREATE SCHEMA "public", which a new Supabase database already has;
    #  - the platform's own default privileges for supabase_admin, which a new
    #    project sets itself and `postgres` (the migration role) may not change.
    sed -e '/^[\]/d' \
        -e 's/^CREATE SCHEMA "public";$/-- public already exists/' \
        -e '/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/d' \
        supabase/migrations/00000000000000_baseline.sql > "$MIGRATIONS/00000000000000_baseline.sql"
    cp supabase/platform.sql "$MIGRATIONS/00000000000001_platform.sql"

    # Only what the app uses: database, auth, REST, storage (+ its image
    # service and the email catcher, which are cheap).
    $SUPABASE start --workdir "$WORKDIR" \
      -x studio,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta

    # The app reads these instead of .env.local's production values
    # (process env wins over .env files in Next and in dotenv).
    $SUPABASE status --workdir "$WORKDIR" -o env \
      --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
      --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
      --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
      --override-name db.url=DATABASE_URL \
      | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL)=' > .env.e2e
    cat >> .env.e2e <<'EOF'
NEXT_PUBLIC_SITE_URL="http://localhost:3100"
STRIPE_SECRET_KEY="sk_test_e2e_dummy"
STRIPE_WEBHOOK_SECRET="whsec_e2e_dummy"
RESEND_API_KEY="re_e2e_dummy"
EOF
    echo "Local Supabase is up; wrote .env.e2e"
    ;;
  stop)
    $SUPABASE stop --workdir "$WORKDIR" --no-backup
    ;;
  *)
    echo "usage: $0 start|stop" >&2
    exit 2
    ;;
esac
