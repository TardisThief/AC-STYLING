#!/usr/bin/env bash
# scripts/backup/dump_storage.sh -- incremental mirror of every Supabase
# storage bucket.
#
#   bash scripts/backup/dump_storage.sh <mirror-dir>
#
# The storage buckets are the least protected thing in the platform: the
# `studio-wardrobe` bucket holds private client photographs, it has been
# private since migration 03 so there is no public URL to re-fetch from, and
# `scripts/cleanup_orphaned_wardrobe_files.ts --delete` can remove objects
# permanently with no undo. Nothing anywhere backs them up today.
#
# Incremental by eTag + size: the first run downloads everything, later runs
# transfer only what changed. That is what makes a nightly job affordable.
#
# Objects that disappear upstream are QUARANTINED, not deleted. An accidental
# or malicious mass-delete in production must not propagate into the backup on
# the next run -- that is precisely the event the backup exists for.
#
# Dependencies are deliberately minimal: psql, curl, coreutils. The object list
# is formatted by Postgres itself rather than by jq, so the backup host needs
# no JSON tooling. Object keys travel base64-encoded so that spaces, quotes and
# non-ASCII names survive the round trip through a TSV.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

MIRROR="${1:-}"
[ -n "$MIRROR" ] || die "usage: dump_storage.sh <mirror-dir>"

require_cmd psql curl base64
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
downloaded=0; skipped=0; failed=0
declare -A SEEN

while IFS=$'\t' read -r etag size b64; do
    [ -n "$b64" ] || continue
    SEEN["$b64"]=1
    key="$(printf '%s' "$b64" | base64 -d)"
    dest="$FILES/$key"

    if [ -f "$dest" ] \
       && [ "${PREV_ETAG[$b64]:-}" = "$etag" ] \
       && [ "${PREV_SIZE[$b64]:-}" = "$size" ]; then
        skipped=$((skipped+1)); continue
    fi

    mkdir -p "$(dirname "$dest")"
    # Download to .partial first: an interrupted run must never leave a
    # truncated file that the next run's eTag check would accept.
    if curl -fsS --retry 3 --retry-delay 2 --max-time 300 \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -o "$dest.partial" \
            "$API/$(urlencode_path "$key")"; then
        mv "$dest.partial" "$dest"
        downloaded=$((downloaded+1))
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
        src="$FILES/$key"
        [ -f "$src" ] || continue
        mkdir -p "$QUARANTINE/$(dirname "$key")"
        mv "$src" "$QUARANTINE/$key"
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
failed=$failed
quarantined=$gone
mirror_bytes=$MIRROR_BYTES
META

log "storage sync: $downloaded new/changed, $skipped unchanged, $failed failed, $gone quarantined ($(human_size "$FILES"))"
[ "$failed" -eq 0 ] || exit 4
