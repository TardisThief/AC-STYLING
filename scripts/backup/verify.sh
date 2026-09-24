#!/usr/bin/env bash
# scripts/backup/verify.sh -- prove a snapshot is loadable without restoring it.
#
#   bash scripts/backup/verify.sh <snapshot-dir>
#
# Checks the things that actually go wrong: a truncated dump that still has a
# valid header, a dump missing the auth schema, a checksum that no longer
# matches, an empty table list. Cheap enough to run on every snapshot.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

SNAP="${1:-}"
[ -n "$SNAP" ] && [ -d "$SNAP" ] || die "usage: verify.sh <snapshot-dir>"
require_cmd pg_restore

DUMP="$SNAP/database.dump"
[ -f "$DUMP" ] || die "no database.dump in $SNAP"

fails=0
check() { if [ "$1" = 0 ]; then log "  PASS  $2"; else log "  FAIL  $2"; fails=$((fails+1)); fi; }

log "verifying $SNAP"

# 1. checksum
EXPECT="$(grep -E '^dump_sha256=' "$SNAP/database.meta" 2>/dev/null | cut -d= -f2)"
ACTUAL="$(sha256_of "$DUMP")"
[ -n "$EXPECT" ] && [ "$EXPECT" = "$ACTUAL" ]; check $? "sha256 matches database.meta"

# 2. the archive's table of contents is readable end to end -- this is what
#    catches a truncated dump, which pg_restore will happily open the header of
TOC="$(mktemp)"; trap 'rm -f "$TOC"' EXIT
pg_restore -l "$DUMP" > "$TOC" 2>/dev/null; check $? "pg_restore -l reads the whole archive"

# 3. the schemas that matter are present
grep -q 'SCHEMA - public' "$TOC"; check $? "public schema present"
grep -qE 'TABLE DATA "?public"? "?profiles"?' "$TOC"; check $? "public.profiles data present"

AUTH_MODE="$(grep -E '^auth_mode=' "$SNAP/database.meta" 2>/dev/null | cut -d= -f2)"
if [ "$AUTH_MODE" = "full" ]; then
    grep -qE 'TABLE DATA "?auth"? "?users"?' "$TOC"; check $? "auth.users data present"
else
    log "  WARN  auth_mode=$AUTH_MODE -- logins are NOT restorable from this snapshot"
fi

# 4. a plausible number of tables
N="$(grep -c 'TABLE DATA' "$TOC" || true)"
[ "${N:-0}" -ge 20 ]; check $? "at least 20 tables with data (found ${N:-0})"

# 5. row counts were recorded, so a restore can be checked against them
[ -s "$SNAP/rowcounts.tsv" ]; check $? "rowcounts.tsv is non-empty"

if [ "$fails" -eq 0 ]; then log "VERIFIED: $SNAP"; else die "$fails check(s) failed for $SNAP"; fi
