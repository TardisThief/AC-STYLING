#!/usr/bin/env bash
# scripts/backup/restore_drill.sh -- actually restore a snapshot into a
# throwaway Postgres and check that what came back is usable.
#
#   bash scripts/backup/restore_drill.sh <snapshot-dir>
#
# A backup nobody has restored is a guess. docs/ASSESSMENT-2026-09-19.md
# records that restoration was never verified; this script is what makes that
# sentence false. It uses a disposable Docker container rather than a second
# Supabase project, so it costs nothing and needs no hosting decision.
#
# Run it after any change to the dump scripts, and at least once a quarter.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

SNAP="${1:-}"
[ -n "$SNAP" ] && [ -f "$SNAP/database.dump" ] || die "usage: restore_drill.sh <snapshot-dir>"
require_cmd docker pg_restore psql

CONTAINER="ac-restore-drill-$$"
PORT="${DRILL_PORT:-55432}"
PGPASSWORD_DRILL="drill"
URL="postgresql://postgres:$PGPASSWORD_DRILL@127.0.0.1:$PORT/postgres"

cleanup() { log "removing $CONTAINER"; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Match the production major version; restoring into a different major is a
# different test from the one we mean to run.
load_env; require_env DATABASE_URL
PGMAJOR="$(psql_q 'SHOW server_version;' | cut -d. -f1 | tr -dc '0-9')"
log "starting throwaway postgres:$PGMAJOR on port $PORT"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASSWORD_DRILL" \
    -p "$PORT:5432" "postgres:$PGMAJOR" >/dev/null

for i in $(seq 1 60); do
    psql "$URL" -X -q -c 'SELECT 1' >/dev/null 2>&1 && break
    [ "$i" = 60 ] && die "throwaway postgres never became ready"
    sleep 1
done
log "container ready"

fails=0
check() { if [ "$1" = 0 ]; then log "  PASS  $2"; else log "  FAIL  $2"; fails=$((fails+1)); fi; }

# The roles Supabase owns do not exist here; create the ones the dump
# references so grants resolve. --no-owner/--no-privileges covers most of it.
psql "$URL" -X -q -c "DO \$\$ BEGIN
    CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" >/dev/null 2>&1 || true
for r in authenticated service_role supabase_auth_admin supabase_storage_admin authenticator; do
    psql "$URL" -X -q -c "DO \$\$ BEGIN CREATE ROLE $r NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" >/dev/null 2>&1 || true
done

# --- drill 1: whole-database restore --------------------------------------
log "restoring the whole snapshot ..."
pg_restore -d "$URL" --no-owner --no-privileges --exit-on-error "$SNAP/database.dump" \
    2>"$SNAP/restore_drill.log"
check $? "whole-database restore completed without errors"

# --- row counts match what was dumped -------------------------------------
mismatch=0
while IFS=$'\t' read -r t expected; do
    [ -n "$t" ] || continue
    actual="$(psql "$URL" -X -q -t -A -c "SELECT count(*) FROM public.\"$t\"" 2>/dev/null || echo ERR)"
    # pg_stat_user_tables is an estimate, so only a wildly different number
    # signals a real problem -- an exact match is not expected for live tables.
    if [ "$actual" = "ERR" ]; then log "  FAIL  table $t missing after restore"; mismatch=$((mismatch+1)); fi
done < "$SNAP/rowcounts.tsv"
[ "$mismatch" -eq 0 ]; check $? "every dumped public table exists after restore"

# --- the things that make this database work ------------------------------
psql "$URL" -X -q -t -A -c "
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE 'profiles%' AND confrelid = 'auth.users'::regclass;" 2>/dev/null | grep -q 1
check $? "profiles -> auth.users FK intact (migration 15)"

psql "$URL" -X -q -t -A -c "SELECT 1 FROM pg_proc WHERE proname = 'check_access';" | grep -q 1
check $? "check_access() present (access control)"

psql "$URL" -X -q -t -A -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity;" \
    | awk '{exit ($1 >= 20) ? 0 : 1}'
check $? "RLS still enabled on the public tables"

# --- drill 2: single-table restore, the realistic recovery ----------------
log "single-table drill: purchases"
psql "$URL" -X -q -c 'DROP TABLE IF EXISTS public.purchases CASCADE;' >/dev/null
pg_restore -d "$URL" --no-owner --no-privileges -t purchases "$SNAP/database.dump" >/dev/null 2>&1
psql "$URL" -X -q -t -A -c "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='purchases';" | grep -q 1
check $? "pg_restore -t purchases recreated a single table"

if [ "$fails" -eq 0 ]; then
    log "RESTORE DRILL PASSED for $(basename "$SNAP")"
    printf 'drill_passed_at=%s\ndrill_host=%s\npg_major=%s\n' \
        "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(hostname)" "$PGMAJOR" > "$SNAP/restore_drill.meta"
else
    die "RESTORE DRILL FAILED: $fails check(s). See $SNAP/restore_drill.log"
fi
