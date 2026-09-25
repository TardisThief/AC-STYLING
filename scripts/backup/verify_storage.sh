#!/usr/bin/env bash
# scripts/backup/verify_storage.sh -- check the storage mirror against its own
# index, without touching production.
#
#   bash scripts/backup/verify_storage.sh <mirror-dir>
#
# dump_storage.sh verifies each object as it accepts it. This is the separate
# question: is what is on the disk RIGHT NOW still what it was? Bit rot, a
# failing SSD, or a half-finished copy will not announce themselves, and the
# mirror holds the only copies of the private client photographs.
#
# Entirely offline -- it reads index.tsv and the files beside it, and makes no
# network calls of any kind.
#
# Every check captures its status through an `if`, because lib.sh sets -e:
# `cmd; check $?` lets a failure abort the script before check() runs, which
# is how a broken verifier looks exactly like a working one.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

MIRROR="${1:-}"
[ -n "$MIRROR" ] && [ -d "$MIRROR" ] || die "usage: verify_storage.sh <mirror-dir>"
require_cmd base64 md5sum

FILES="$MIRROR/files"
INDEX="$MIRROR/index.tsv"

fails=0
check() { if [ "$1" = 0 ]; then log "  PASS  $2"; else log "  FAIL  $2"; fails=$((fails+1)); fi; }

log "verifying storage mirror $MIRROR"

if [ -s "$INDEX" ]; then rc=0; else rc=1; fi
check "$rc" "index.tsv is present and non-empty"
[ "$rc" = 0 ] || { log "$fails check(s) failed for $MIRROR"; exit 1; }

etag_md5() {
    local e="${1//\"/}"
    case "$e" in
        [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) printf '%s' "$e" ;;
        *) printf '' ;;
    esac
}

total=0; missing=0; wrongsize=0; wrongmd5=0; unhashable=0
while IFS=$'\t' read -r etag size b64; do
    [ -n "$b64" ] || continue
    total=$((total+1))
    key="$(printf '%s' "$b64" | base64 -d)"
    path="$FILES/$key"

    if [ ! -f "$path" ]; then
        log "        missing: $key"
        missing=$((missing+1)); continue
    fi
    actual="$(file_size "$path")"
    if [ "$actual" != "$size" ]; then
        log "        size $actual, expected $size: $key"
        wrongsize=$((wrongsize+1)); continue
    fi
    want="$(etag_md5 "$etag")"
    if [ -z "$want" ]; then
        unhashable=$((unhashable+1)); continue     # multipart eTag: size only
    fi
    if [ "$(md5_of "$path")" != "$want" ]; then
        log "        md5 mismatch: $key"
        wrongmd5=$((wrongmd5+1))
    fi
done < "$INDEX"

if [ "$missing" -eq 0 ]; then rc=0; else rc=1; fi
check "$rc" "every indexed object has a local file ($missing missing)"
if [ "$wrongsize" -eq 0 ]; then rc=0; else rc=1; fi
check "$rc" "every local file matches its recorded size ($wrongsize wrong)"
if [ "$wrongmd5" -eq 0 ]; then rc=0; else rc=1; fi
check "$rc" "every local file matches its eTag ($wrongmd5 mismatched)"

[ "$unhashable" -eq 0 ] \
    || log "  WARN  $unhashable object(s) have multipart eTags -- size checked, contents not"

verified=$(( total - missing - wrongsize - wrongmd5 ))
if [ "$fails" -eq 0 ]; then
    log "VERIFIED: $verified of $total object(s) in $MIRROR"
else
    log "$fails check(s) failed for $MIRROR ($verified of $total objects intact)"
    exit 1
fi
