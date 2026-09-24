#!/usr/bin/env bash
# scripts/backup/backup.sh -- the nightly cron entrypoint on hermes.
#
#   bash scripts/backup/backup.sh            # normal nightly run
#   bash scripts/backup/backup.sh --no-pull  # skip the git pull
#   bash scripts/backup/backup.sh --tag pre-migration-21   # on-demand snapshot
#
# Sequence: pull the scripts -> dump the database -> mirror the storage buckets
# -> write a manifest -> prune old snapshots (GFS) -> push off-site to R2 ->
# ping the heartbeat. The heartbeat is pinged LAST and only on success, so a
# failure at any step turns into an alert rather than a silent gap.
#
# ON ENCRYPTION: off-site copies are encrypted by an rclone `crypt` remote,
# which encrypts contents and filenames and still syncs incrementally. Copies
# on the local SSD are plaintext, deliberately: hermes already holds the
# service-role key, so it can read all of this data live. Encrypting the local
# copy against the machine that holds the live credentials would protect
# nothing while making restore drills harder. What leaves the building is
# encrypted; what stays sits behind the same trust boundary as the credentials.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. "$REPO_ROOT/scripts/backup/lib.sh"

PULL=1; TAG=""
while [ $# -gt 0 ]; do
    case "$1" in
        --no-pull) PULL=0 ;;
        --tag) TAG="${2:-}"; shift ;;
        *) die "unknown argument: $1" ;;
    esac
    shift
done

require_cmd psql pg_dump curl
load_env
require_env DATABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY AC_BACKUP_ROOT

STAMP="$(date -u '+%Y-%m-%dT%H%M%SZ')"
NAME="${TAG:+$TAG--}$STAMP"
SNAP="$AC_BACKUP_ROOT/db/$NAME"
MIRROR="$AC_BACKUP_ROOT/storage-mirror"
mkdir -p "$SNAP" "$MIRROR"

STATUS="ok"
note() { STATUS="degraded"; warn "$*"; }

fail_and_exit() {
    log "BACKUP FAILED: $*"
    [ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 15 --retry 2 \
        --data-raw "backup failed: $*" "${HEALTHCHECK_URL%/}/fail" >/dev/null 2>&1 || true
    exit 1
}
trap 'fail_and_exit "unexpected error on line $LINENO"' ERR

if [ "$PULL" = 1 ] && [ -d "$REPO_ROOT/.git" ]; then
    log "pulling backup scripts ..."
    git -C "$REPO_ROOT" pull --ff-only --quiet || note "git pull failed; running the scripts as they are on disk"
fi

# --- database -------------------------------------------------------------
# An `if` condition suppresses both errexit AND the ERR trap; `set +e` alone
# does not stop the trap, which would turn a degraded-but-usable dump into a
# hard abort and skip the storage mirror entirely.
if bash "$REPO_ROOT/scripts/backup/dump_database.sh" "$SNAP"; then db_rc=0; else db_rc=$?; fi
case "$db_rc" in
    0) ;;
    3) note "database dumped WITHOUT the auth schema -- logins are not restorable from this snapshot" ;;
    *) fail_and_exit "dump_database.sh exited $db_rc" ;;
esac

# --- storage --------------------------------------------------------------
if bash "$REPO_ROOT/scripts/backup/dump_storage.sh" "$MIRROR"; then st_rc=0; else st_rc=$?; fi
case "$st_rc" in
    0) ;;
    4) note "some storage objects failed to download -- see the log; they retry next run" ;;
    *) fail_and_exit "dump_storage.sh exited $st_rc" ;;
esac

# --- manifest -------------------------------------------------------------
kv() { grep -E "^$2=" "$1" 2>/dev/null | cut -d= -f2- | head -1; }
# Built with printf rather than jq: the backup host should need nothing
# beyond psql, curl and coreutils. Every value here is a number or a
# machine-generated identifier, so no escaping is required.
num() { local v; v="$(kv "$1" "$2")"; case "$v" in ''|*[!0-9]*) echo null ;; *) echo "$v" ;; esac; }
cat > "$SNAP/manifest.json" <<JSON
{
  "name": "$NAME",
  "tag": "${TAG:-nightly}",
  "status": "$STATUS",
  "started_at": "$STAMP",
  "finished_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "host": "$(hostname)",
  "script_revision": "$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)",
  "database": {
    "auth_mode": "$(kv "$SNAP/database.meta" auth_mode)",
    "public_tables": $(num "$SNAP/database.meta" public_tables),
    "sha256": "$(kv "$SNAP/database.meta" dump_sha256)",
    "bytes": $(num "$SNAP/database.meta" dump_bytes)
  },
  "storage": {
    "objects": $(num "$MIRROR/storage.meta" upstream_objects),
    "bytes": $(num "$MIRROR/storage.meta" mirror_bytes),
    "quarantined": $(num "$MIRROR/storage.meta" quarantined)
  }
}
JSON

# --- retention (grandfather-father-son) -----------------------------------
# Tagged snapshots (pre-migration ones) are never pruned automatically; they
# exist because someone deliberately marked that moment.
prune() {
    local keep_daily=7 keep_weekly=4 keep_monthly=12
    # Counters rather than ${#array[@]}: on bash 4.3 and earlier, expanding an
    # empty associative array under `set -u` aborts the script, which here
    # would abort the backup itself.
    local nd=0 nw=0 nm=0
    declare -A kd kw km
    local dir base day week month keep
    while IFS= read -r dir; do
        base="$(basename "$dir")"
        case "$base" in *--*) continue ;; esac        # tagged: keep forever
        day="${base:0:10}"
        month="${base:0:7}"
        week="$(date -u -d "$day" +%G-%V 2>/dev/null || echo "$day")"
        keep=0
        if [ -n "${kd[$day]+x}" ]; then keep=1
        elif [ "$nd" -lt "$keep_daily" ]; then kd[$day]=1; nd=$((nd+1)); keep=1
        elif [ -z "${kw[$week]+x}" ] && [ "$nw" -lt "$keep_weekly" ]; then kw[$week]=1; nw=$((nw+1)); keep=1
        elif [ -z "${km[$month]+x}" ] && [ "$nm" -lt "$keep_monthly" ]; then km[$month]=1; nm=$((nm+1)); keep=1
        fi
        if [ "$keep" = 0 ]; then log "pruning $base"; rm -rf "$dir"; fi
    done < <(find "$AC_BACKUP_ROOT/db" -mindepth 1 -maxdepth 1 -type d | sort -r)
}
prune

# --- off-site -------------------------------------------------------------
if [ -n "${RCLONE_REMOTE:-}" ]; then
    require_cmd rclone

    # `rclone sync` mirrors deletions. If the external SSD were ever unmounted,
    # the local tree would look empty and the sync would faithfully erase the
    # off-site copy -- turning the backup system into the thing that destroys
    # the backups. Two guards, because this failure is silent and total:
    #
    #   1. refuse to sync unless the snapshot we just wrote is really there
    #   2. cap how much one run is allowed to delete remotely
    [ -s "$SNAP/database.dump" ] \
        || fail_and_exit "refusing to sync: $SNAP/database.dump is missing or empty"
    [ -f "$MIRROR/index.tsv" ] || [ "$(kv "$MIRROR/storage.meta" upstream_objects)" = "0" ] \
        || fail_and_exit "refusing to sync: the storage mirror index is missing"

    # Normalise "acbackup:" / "acbackup:path/" into a clean prefix, so we never
    # build "acbackup:/db" with a stray leading slash.
    REMOTE="${RCLONE_REMOTE%/}"
    case "$REMOTE" in *:) ;; *) REMOTE="$REMOTE/" ;; esac

    log "pushing to $REMOTE ..."
    rclone sync "$AC_BACKUP_ROOT/db" "${REMOTE}db" \
        --transfers 4 --stats-one-line --max-delete 10 \
        || fail_and_exit "rclone sync of the database snapshots failed (--max-delete may have tripped: check what changed locally before overriding it)"
    rclone sync "$MIRROR" "${REMOTE}storage" \
        --transfers 8 --stats-one-line --max-delete 100 \
        || fail_and_exit "rclone sync of the storage mirror failed (--max-delete may have tripped: a large deletion upstream is exactly what you would want to inspect by hand)"
    printf '%s\n' "$NAME" | rclone rcat "${REMOTE}LATEST" \
        || note "could not update the LATEST marker"
else
    note "RCLONE_REMOTE is not set -- this backup exists ONLY on this machine"
fi

trap - ERR
log "backup complete: $NAME ($STATUS)"

if [ -n "${HEALTHCHECK_URL:-}" ]; then
    if [ "$STATUS" = "ok" ]; then
        curl -fsS -m 15 --retry 2 --data-raw "$(cat "$SNAP/manifest.json")" "$HEALTHCHECK_URL" >/dev/null || warn "heartbeat ping failed"
    else
        # A degraded backup must not look healthy. Log it as a failure so the
        # alert fires while the snapshot is still kept.
        curl -fsS -m 15 --retry 2 --data-raw "degraded: $(cat "$SNAP/manifest.json")" "${HEALTHCHECK_URL%/}/fail" >/dev/null || true
    fi
fi

[ "$STATUS" = "ok" ] || exit 5
