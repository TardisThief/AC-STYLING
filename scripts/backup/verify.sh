#!/usr/bin/env bash
# scripts/backup/verify.sh -- prove a snapshot is loadable without restoring it.
#
#   bash scripts/backup/verify.sh <snapshot-dir>
#
# Checks the things that actually go wrong: a truncated dump that still has a
# valid header, a dump missing the auth schema, a checksum that no longer
# matches, a table whose data never made it into the archive. Cheap enough to
# run on every snapshot.
#
# Every check captures its status through an `if`, because lib.sh sets -e:
# writing `cmd; check $?` lets a failing command abort the script before
# check() runs, so a corrupted snapshot produced an exit code and no reason.
# That bug shipped here twice; if you add a check, use the idiom below.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

SNAP="${1:-}"
[ -n "$SNAP" ] && [ -d "$SNAP" ] || die "usage: verify.sh <snapshot-dir>"
require_cmd pg_restore

DUMP="$SNAP/database.dump"
[ -f "$DUMP" ] || die "no database.dump in $SNAP"

fails=0
check() { if [ "$1" = 0 ]; then log "  PASS  $2"; else log "  FAIL  $2"; fails=$((fails+1)); fi; }

# `|| true` is load-bearing on these: under `set -e` with `pipefail`, an
# assignment whose command substitution fails aborts the script, so a snapshot
# simply missing database.meta would kill the run instead of failing a check.
meta() { grep -E "^$1=" "$SNAP/database.meta" 2>/dev/null | cut -d= -f2 || true; }

log "verifying $SNAP"

# 1. checksum
EXPECT="$(meta dump_sha256)"
ACTUAL="$(sha256_of "$DUMP")"
if [ -n "$EXPECT" ] && [ "$EXPECT" = "$ACTUAL" ]; then rc=0; else rc=1; fi
check "$rc" "sha256 matches database.meta"
[ "$rc" = 0 ] || log "        expected ${EXPECT:-<none recorded>}, got $ACTUAL"

# 2. the archive's table of contents is readable end to end -- this is what
#    catches a truncated dump, which pg_restore will happily open the header of
TOC="$(mktemp)"
trap 'rm -f "$TOC"' EXIT
if pg_restore -l "$DUMP" > "$TOC" 2>/dev/null; then rc=0; else rc=$?; fi
check "$rc" "pg_restore -l reads the whole archive"

# 3. the schemas that matter are present
if grep -q 'SCHEMA - public' "$TOC"; then rc=0; else rc=1; fi
check "$rc" "public schema present"

if grep -qE 'TABLE DATA "?public"? "?profiles"?' "$TOC"; then rc=0; else rc=1; fi
check "$rc" "public.profiles data present"

AUTH_MODE="$(meta auth_mode)"
if [ "$AUTH_MODE" = "full" ]; then
    if grep -qE 'TABLE DATA "?auth"? "?users"?' "$TOC"; then rc=0; else rc=1; fi
    check "$rc" "auth.users data present"
else
    log "  WARN  auth_mode=$AUTH_MODE -- logins are NOT restorable from this snapshot"
fi

# 4. a plausible number of tables
N="$(grep -c 'TABLE DATA' "$TOC" || true)"
if [ "${N:-0}" -ge 20 ]; then rc=0; else rc=1; fi
check "$rc" "at least 20 tables with data (found ${N:-0})"

# 5. row counts were recorded, so a restore can be checked against them
if [ -s "$SNAP/rowcounts.tsv" ]; then rc=0; else rc=1; fi
check "$rc" "rowcounts.tsv is non-empty"

# 6. every table known to hold rows actually has a data section.
#    `pg_dump --exclude-table-data` (or anything that behaves like it) produces
#    an archive that recreates the table empty, which the count above still
#    counts and which a restore happily reproduces. Checking the TOC by name is
#    the only thing here that would notice.
ROWCOUNTS_MODE="$(meta rowcounts)"
if [ -s "$SNAP/rowcounts.tsv" ]; then
    dataless=""
    while IFS=$'\t' read -r t n; do
        [ -n "$t" ] || continue
        case "${n:-0}" in ''|*[!0-9]*) continue ;; esac
        [ "$n" -gt 0 ] || continue
        grep -qE "TABLE DATA \"?public\"? \"?$t\"?( |\$)" "$TOC" || dataless="$dataless $t"
    done < "$SNAP/rowcounts.tsv"

    if [ -z "$dataless" ]; then
        check 0 "every table recorded with rows has a data section"
    elif [ "$ROWCOUNTS_MODE" = "exact" ]; then
        log "        no data section for:$dataless"
        check 1 "every table recorded with rows has a data section"
    else
        # A legacy snapshot's counts are pg_stat estimates, so a stale non-zero
        # against a genuinely empty table would be a false alarm. Say it, do
        # not fail on it.
        log "  WARN  no data section for:$dataless (counts are estimates, not proof)"
    fi
fi

if [ "$fails" -eq 0 ]; then
    log "VERIFIED: $SNAP"
else
    log "$fails check(s) failed for $SNAP"
    exit 1
fi
