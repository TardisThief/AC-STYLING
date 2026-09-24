#!/usr/bin/env bash
# scripts/backup/dump_database.sh -- logical dump of the live Supabase database.
#
#   bash scripts/backup/dump_database.sh <output-dir>
#
# Produces, in <output-dir>:
#   database.dump   custom-format (-Fc) dump -- restorable whole OR one table
#                   at a time with `pg_restore -t`, which is the realistic
#                   recovery path when a migration damages a single table.
#   schema.sql      plain-text schema, so the archive stays human-diffable
#   rowcounts.tsv   row count per public table, to verify a restore against
#   database.meta   what was dumped and how (see AUTH SCHEMA below)
#
# AUTH SCHEMA: `auth` is not optional. Migration 15 added
# `profiles.id -> auth.users(id) ON DELETE CASCADE`, so a public-only dump
# cannot be restored on its own -- every profile row would violate its FK.
# The `auth` tables are owned by `supabase_auth_admin`, and whether the
# `postgres` role can read them varies by project, so this script tries the
# full dump first and falls back to a CSV export of the auth tables it CAN
# read, recording which path it took rather than silently producing less.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

OUT="${1:-}"
[ -n "$OUT" ] || die "usage: dump_database.sh <output-dir>"
mkdir -p "$OUT"

require_cmd pg_dump psql
load_env
require_env DATABASE_URL
assert_pg_dump_version

DUMP="$OUT/database.dump"
TMP="$DUMP.partial"
trap 'rm -f "$TMP"' EXIT

COMMON=(--no-owner --no-privileges --quote-all-identifiers)
AUTH_MODE="full"

log "dumping schemas public, auth, storage ..."
if ! pg_dump "$DATABASE_URL" -Fc "${COMMON[@]}" \
        --schema=public --schema=auth --schema=storage \
        -f "$TMP" 2>"$OUT/pg_dump.log"; then
    warn "full dump failed; see pg_dump.log. Retrying without the auth schema."
    AUTH_MODE="fallback"
    rm -f "$TMP"
    pg_dump "$DATABASE_URL" -Fc "${COMMON[@]}" \
        --schema=public --schema=storage \
        -f "$TMP" 2>>"$OUT/pg_dump.log" \
        || die "pg_dump failed even without auth. See $OUT/pg_dump.log."
fi
mv "$TMP" "$DUMP"
trap - EXIT

# Fallback path: grab the identity tables as CSV so accounts are at least
# reconstructable by hand. This is a degraded backup and says so.
if [ "$AUTH_MODE" = "fallback" ]; then
    mkdir -p "$OUT/auth-csv"
    got=0
    for t in users identities; do
        if psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 \
             -c "\copy (SELECT * FROM auth.$t) TO '$OUT/auth-csv/$t.csv' WITH CSV HEADER" 2>/dev/null; then
            got=$((got+1))
        else
            warn "could not read auth.$t"
        fi
    done
    [ "$got" -gt 0 ] || AUTH_MODE="missing"
    warn "AUTH DUMP IS DEGRADED ($AUTH_MODE). A restore will NOT recreate logins automatically."
fi

log "writing plain-text schema ..."
pg_dump "$DATABASE_URL" "${COMMON[@]}" --schema-only --schema=public \
    -f "$OUT/schema.sql" 2>>"$OUT/pg_dump.log" \
    || warn "schema-only dump failed; the binary dump still contains the schema."

# Row counts are the cheapest possible restore check: after a restore you
# compare these numbers instead of trusting that "it ran without errors".
log "recording row counts ..."
psql_q "
    SELECT relname, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname;
" | tr '|' '\t' > "$OUT/rowcounts.tsv"

TABLES=$(wc -l < "$OUT/rowcounts.tsv" | tr -d ' ')
SIZE=$(human_size "$DUMP")
SHA=$(sha256_of "$DUMP")

cat > "$OUT/database.meta" <<META
dumped_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
auth_mode=$AUTH_MODE
schemas=$([ "$AUTH_MODE" = full ] && echo "public,auth,storage" || echo "public,storage")
public_tables=$TABLES
dump_bytes=$(wc -c < "$DUMP" | tr -d ' ')
dump_sha256=$SHA
pg_dump_version=$(pg_dump --version | head -1)
META

log "database dump complete: $SIZE, $TABLES public tables, auth=$AUTH_MODE"
[ "$AUTH_MODE" = "full" ] || exit 3   # non-zero: backup.sh treats this as a partial success
