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
#
# This script writes ONLY to its own container on 127.0.0.1. It reads the
# production connection string once, to learn the server's major version, and
# never writes through it.

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

# Every check below captures its exit status through an `if`, because lib.sh
# sets -e: writing `cmd; check $?` lets a failing command abort the script
# before check() ever runs, so the drill exits silently instead of reporting
# which check failed. That is how a broken drill looked like no drill at all.
status_of() { if "$@" >/dev/null 2>&1; then echo 0; else echo $?; fi; }

# The roles Supabase owns do not exist here; create the ones the dump
# references so grants resolve. --no-owner/--no-privileges covers most of it.
for r in anon authenticated service_role supabase_auth_admin supabase_storage_admin authenticator; do
    psql "$URL" -X -q -c "DO \$\$ BEGIN CREATE ROLE $r NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" >/dev/null 2>&1 || true
done

# dump_database.sh passes --schema=public explicitly, so the archive carries
# `CREATE SCHEMA public` -- and a stock postgres image already has one. With
# --exit-on-error (which we keep, so any OTHER error still fails the drill)
# pg_restore aborted on the very first statement. Drop the empty schema first,
# in the THROWAWAY container only, so the archive can recreate it as dumped.
log "clearing the stock public schema in the throwaway container ..."
psql "$URL" -X -q -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE;' >/dev/null \
    || die "could not drop the stock public schema in the drill container"

# --- drill 1: whole-database restore --------------------------------------
log "restoring the whole snapshot ..."
if pg_restore -d "$URL" --no-owner --no-privileges --exit-on-error \
       "$SNAP/database.dump" 2>"$SNAP/restore_drill.log"; then rc=0; else rc=$?; fi
check "$rc" "whole-database restore completed without errors"

# --- row counts against what was dumped -----------------------------------
# rowcounts.tsv comes from pg_stat_user_tables, which is an estimate, so exact
# equality is not expected. A table that HAD rows and came back empty is not
# estimation error, though -- that is data that did not survive the round trip.
missing=0; emptied=0
while IFS=$'\t' read -r t expected; do
    [ -n "$t" ] || continue
    if actual="$(psql "$URL" -X -q -t -A -c "SELECT count(*) FROM public.\"$t\"" 2>/dev/null)"; then :; else actual=""; fi
    actual="$(printf '%s' "$actual" | tr -dc '0-9')"
    if [ -z "$actual" ]; then
        log "        table $t is missing after restore"
        missing=$((missing+1)); continue
    fi
    case "${expected:-0}" in ''|*[!0-9]*) continue ;; esac
    if [ "$expected" -gt 0 ] && [ "$actual" -eq 0 ]; then
        log "        table $t: dumped with ~$expected row(s), restored with 0"
        emptied=$((emptied+1))
    fi
done < "$SNAP/rowcounts.tsv"
if [ "$missing" -eq 0 ]; then rc=0; else rc=1; fi
check "$rc" "every dumped public table exists after restore"
if [ "$emptied" -eq 0 ]; then rc=0; else rc=1; fi
check "$rc" "no table that had rows restored empty ($emptied affected)"

# --- the things that make this database work ------------------------------
has_row() { psql "$URL" -X -q -t -A -c "$1" 2>/dev/null | grep -q 1; }

rc=$(status_of has_row "
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE 'profiles%' AND confrelid = 'auth.users'::regclass;")
check "$rc" "profiles -> auth.users FK intact (migration 15)"

rc=$(status_of has_row "SELECT 1 FROM pg_proc WHERE proname = 'check_access';")
check "$rc" "check_access() present (access control)"

rls="$(psql "$URL" -X -q -t -A -c \
    "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity;" 2>/dev/null | tr -dc '0-9')"
if [ -n "$rls" ] && [ "$rls" -ge 20 ]; then rc=0; else rc=1; fi
check "$rc" "RLS still enabled on the public tables (${rls:-0})"

# A dump whose auth schema came back empty restores the data but not anyone's
# ability to sign in, which is the failure most likely to go unnoticed until
# it matters.
AUTH_MODE="$(grep -E '^auth_mode=' "$SNAP/database.meta" 2>/dev/null | cut -d= -f2)"
if [ "$AUTH_MODE" = "full" ]; then
    users="$(psql "$URL" -X -q -t -A -c 'SELECT count(*) FROM auth.users;' 2>/dev/null | tr -dc '0-9')"
    if [ -n "$users" ] && [ "$users" -gt 0 ]; then rc=0; else rc=1; fi
    check "$rc" "auth.users restored with ${users:-0} row(s)"
else
    log "  WARN  auth_mode=$AUTH_MODE -- logins are not restorable from this snapshot"
fi

# --- drill 2: single-table restore, the realistic recovery ----------------
log "single-table drill: purchases"
psql "$URL" -X -q -c 'DROP TABLE IF EXISTS public.purchases CASCADE;' >/dev/null 2>&1 || true
if pg_restore -d "$URL" --no-owner --no-privileges -t purchases \
       "$SNAP/database.dump" >/dev/null 2>&1; then rc=0; else rc=$?; fi
check "$rc" "pg_restore -t purchases ran"
rc=$(status_of has_row "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='purchases';")
check "$rc" "pg_restore -t purchases recreated a single table"

if [ "$fails" -eq 0 ]; then
    log "RESTORE DRILL PASSED for $(basename "$SNAP")"
    printf 'drill_passed_at=%s\ndrill_host=%s\npg_major=%s\n' \
        "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(hostname)" "$PGMAJOR" > "$SNAP/restore_drill.meta"
else
    log "RESTORE DRILL FAILED: $fails check(s). See $SNAP/restore_drill.log"
    exit 1
fi
