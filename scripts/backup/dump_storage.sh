#!/usr/bin/env bash
# scripts/backup/dump_storage.sh -- incremental, verified mirror of every
# Supabase storage bucket.
#
#   bash scripts/backup/dump_storage.sh <mirror-dir>
#
# The storage buckets are the least protected thing in the platform: the
# `studio-wardrobe` bucket holds private client photographs, it has been
# private since migration 03 so there is no public URL to re-fetch from, and
# `scripts/cleanup_orphaned_wardrobe_files.ts --delete` can remove objects
# permanently with no undo.
#
# VERIFICATION, and why it is not optional. This script used to decide a file
# was up to date by comparing UPSTREAM metadata against the PREVIOUS INDEX --
# it never looked at the local file at all. So a mirrored image that was
# corrupted, truncated, or saved from a download that ended early stayed
# broken for ever, every run reported "unchanged", and the backup was declared
# healthy. Worse, the damaged file would then sync over the good copy in R2.
# Now every accepted file is checked against the object's size and, where the
# eTag is a plain MD5, its content hash -- on download AND on skip.
#
# Cost: the mirror is ~56 MB, so hashing all of it takes well under a second.
# If it ever grows to where that matters, the cheap split is size-every-run
# plus MD5 weekly; do that rather than dropping the check.
#
# Objects that disappear upstream are QUARANTINED, not deleted, and so are
# locally damaged files before they are replaced. An accidental mass-delete
# upstream, or a failing disk here, must not destroy evidence.
#
# Dependencies stay minimal: psql, curl, coreutils. The object list is
# formatted by Postgres itself rather than by jq. Object keys travel
# base64-encoded so spaces, quotes and non-ASCII names survive the TSV.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

MIRROR="${1:-}"
[ -n "$MIRROR" ] || die "usage: dump_storage.sh <mirror-dir>"

require_cmd psql curl base64 md5sum
load_env
require_env DATABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

FILES="$MIRROR/files"
INDEX="$MIRROR/index.tsv"
QUARANTINE="$MIRROR/quarantined/$(date -u '+%Y%m%dT%H%M%SZ')"
mkdir -p "$FILES"

# Percent-encode one path segment, byte by byte, leaving the unreserved set
# alone. LC_ALL=C makes the loop walk bytes rather than characters, so UTF-8
# filenames encode correctly.
urlencode_segment() {
    local s="$1" out="" i c
    local LC_ALL=C
    for (( i = 0; i < ${#s}; i++ )); do
        c="${s:i:1}"
        case "$c" in
            [a-zA-Z0-9.~_-]) out+="$c" ;;
            *) out+="$(printf '%%%02X' "'$c")" ;;
        esac
    done
    printf '%s' "$out"
}

# Encode a whole key, preserving the slashes that separate path segments.
urlencode_path() {
    local IFS=/ first=1 out="" seg
    for seg in $1; do
        if [ "$first" = 1 ]; then out="$(urlencode_segment "$seg")"; first=0
        else out="$out/$(urlencode_segment "$seg")"; fi
    done
    printf '%s' "$out"
}

# Object keys come from production metadata and get joined onto $FILES, so a
# key containing a parent-directory segment would write outside the mirror.
# Nothing in this app produces such a name; that is exactly why a check here
# is cheap and a surprise later would not be.
key_is_safe() {
    case "$1" in
        '' | /* ) return 1 ;;
        ../* | */../* | */.. ) return 1 ;;
        *$'\n'* ) return 1 ;;      # ANSI-C quoted: $(printf) strips the newline
    esac
    return 0
}

# Supabase sets an object's eTag to its MD5, quoted. Multipart uploads instead
# get "<md5>-<parts>", which is NOT the file's MD5 -- those get a size check
# only. All 74 objects in the live mirror are plain MD5 today.
etag_md5() {
    local e="${1//\"/}"
    case "$e" in
        [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) printf '%s' "$e" ;;
        *) printf '' ;;
    esac
}

# Does the file on disk match what upstream says it should be? Prints the
# reason when it does not, so callers can log it.
file_matches() {
    local path="$1" size="$2" etag="$3" actual md5 want
    [ -f "$path" ] || { printf 'missing'; return 1; }
    actual="$(file_size "$path")"
    if [ "$actual" != "$size" ]; then printf 'size %s/%s' "$actual" "$size"; return 1; fi
    want="$(etag_md5 "$etag")"
    [ -n "$want" ] || return 0            # multipart eTag: size is all we have
    md5="$(md5_of "$path")"
    if [ "$md5" != "$want" ]; then printf 'md5 mismatch'; return 1; fi
    return 0
}

quarantine_file() {
    local key="$1"
    mkdir -p "$QUARANTINE/$(dirname "$key")"
    mv "$FILES/$key" "$QUARANTINE/$key"
}

log "listing storage objects ..."
NEW="$MIRROR/index.new"
# Postgres emits the TSV directly. `translate(..., E'\n', '')` strips the line
# wrapping that encode(...,'base64') inserts every 76 characters.
psql_q "
    SELECT coalesce(o.metadata->>'eTag', '')
        || E'\t' || coalesce(o.metadata->>'size', '0')
        || E'\t' || translate(
               encode(convert_to(o.bucket_id || '/' || o.name, 'UTF8'), 'base64'),
               E'\n', '')
    FROM storage.objects o
    ORDER BY o.bucket_id, o.name;
" | grep -v '^[[:space:]]*$' > "$NEW"

TOTAL=$(wc -l < "$NEW" | tr -d ' ')
log "$TOTAL object(s) upstream"

declare -A PREV_ETAG PREV_SIZE
if [ -f "$INDEX" ]; then
    while IFS=$'\t' read -r etag size b64; do
        [ -n "$b64" ] || continue
        PREV_ETAG["$b64"]="$etag"; PREV_SIZE["$b64"]="$size"
    done < "$INDEX"
fi

API="${NEXT_PUBLIC_SUPABASE_URL%/}/storage/v1/object"
downloaded=0; skipped=0; failed=0; verified=0; repaired=0
declare -A SEEN

while IFS=$'\t' read -r etag size b64; do
    [ -n "$b64" ] || continue
    SEEN["$b64"]=1
    key="$(printf '%s' "$b64" | base64 -d)"

    if ! key_is_safe "$key"; then
        warn "refusing unsafe object key: $(printf '%q' "$key")"
        failed=$((failed+1)); continue
    fi
    dest="$FILES/$key"

    # Unchanged upstream AND intact on disk. The second half is the point:
    # the index agreeing with upstream says nothing about the bytes here.
    if [ "${PREV_ETAG[$b64]:-}" = "$etag" ] && [ "${PREV_SIZE[$b64]:-}" = "$size" ]; then
        if why="$(file_matches "$dest" "$size" "$etag")"; then
            skipped=$((skipped+1)); verified=$((verified+1)); continue
        elif [ "$why" != "missing" ]; then
            warn "local copy damaged, re-downloading: $key ($why)"
            quarantine_file "$key"
            repaired=$((repaired+1))
        fi
        # missing, or damaged and now quarantined: fall through and fetch it
    fi

    mkdir -p "$(dirname "$dest")"
    # Download to .partial and verify before accepting. curl exiting 0 is not
    # proof of a complete body: a connection that ends early still yields a
    # success status and a short file, which used to be saved and indexed as
    # good, permanently.
    if curl -fsS --retry 3 --retry-delay 2 --max-time 300 \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -o "$dest.partial" \
            "$API/$(urlencode_path "$key")"; then
        if why="$(file_matches "$dest.partial" "$size" "$etag")"; then
            mv "$dest.partial" "$dest"
            downloaded=$((downloaded+1)); verified=$((verified+1))
        else
            rm -f "$dest.partial"
            warn "download failed verification: $key ($why)"
            failed=$((failed+1))
        fi
    else
        rm -f "$dest.partial"; warn "download failed: $key"; failed=$((failed+1))
    fi
done < "$NEW"

# Anything in the mirror that is no longer upstream goes to quarantine.
gone=0
if [ -f "$INDEX" ]; then
    while IFS=$'\t' read -r _ _ b64; do
        [ -n "$b64" ] && [ -z "${SEEN[$b64]:-}" ] || continue
        key="$(printf '%s' "$b64" | base64 -d)"
        key_is_safe "$key" || continue
        [ -f "$FILES/$key" ] || continue
        quarantine_file "$key"
        gone=$((gone+1))
    done < "$INDEX"
fi
[ "$gone" -eq 0 ] || warn "$gone object(s) vanished upstream -> quarantined in $QUARANTINE (not deleted)"

# Only advance the index if nothing failed; otherwise the next run must retry.
if [ "$failed" -eq 0 ]; then
    mv "$NEW" "$INDEX"
else
    warn "index not advanced ($failed failure(s)); next run will retry them"
    rm -f "$NEW"
fi

MIRROR_BYTES=$(du -sb "$FILES" 2>/dev/null | cut -f1 || echo 0)
cat > "$MIRROR/storage.meta" <<META
synced_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
upstream_objects=$TOTAL
downloaded=$downloaded
unchanged=$skipped
verified=$verified
repaired=$repaired
failed=$failed
quarantined=$gone
mirror_bytes=$MIRROR_BYTES
META

log "storage sync: $verified verified, $downloaded new/changed, $skipped unchanged, $repaired repaired, $failed failed, $gone quarantined ($(human_size "$FILES"))"
# A repair means a file on this disk had rotted since it was written. The
# backup is still good -- it was re-fetched and verified -- but the hardware
# is telling you something.
[ "$repaired" -eq 0 ] \
    || warn "$repaired local file(s) were damaged and re-fetched; originals kept in $QUARANTINE. Check this machine's disk."
[ "$failed" -eq 0 ] || exit 4
