# scripts/backup/lib.sh
# Shared helpers for the AC Styling backup scripts. Sourced, never executed.
#
# Every script here runs unattended on the hermes backup host, so the rules are:
# fail loudly and early, never print a secret, and never leave a half-written
# artifact that a later run would mistake for a good backup.

set -euo pipefail

# Everything these scripts write is private customer data: auth.users rows and
# the client photographs from the studio-wardrobe bucket. Default umasks on
# Ubuntu produce 664/775, i.e. world-readable, which is wrong for a backup that
# sits on a shared host. Set it here rather than in each script so it applies
# however a script is invoked -- cron, by hand, or from another script.
umask 077

log()  { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
die()  { log "ERROR: $*"; exit 1; }
warn() { log "WARNING: $*"; }

require_cmd() {
    for c in "$@"; do
        command -v "$c" >/dev/null 2>&1 || die "\`$c\` is not installed. See docs/HERMES-BACKUP-SETUP.md."
    done
}

# Load configuration from the first file that exists. On hermes this is
# ~/.ac-styling/.env.backup (chmod 600); on a dev machine it is the repo's
# .env.local, so the same scripts work in both places.
load_env() {
    local candidates=(
        "${AC_BACKUP_ENV:-}"
        "$HOME/.ac-styling/.env.backup"
        "$REPO_ROOT/.env.local"
    )
    for f in "${candidates[@]}"; do
        [ -n "$f" ] && [ -f "$f" ] || continue
        log "config: $f"
        # shellcheck disable=SC1090
        set -a; . "$f"; set +a
        AC_ENV_FILE="$f"
        return 0
    done
    die "No config file found. Expected \$AC_BACKUP_ENV, ~/.ac-styling/.env.backup or .env.local."
}

require_env() {
    for v in "$@"; do
        [ -n "${!v:-}" ] || die "$v is missing from ${AC_ENV_FILE:-the config file}."
    done
}

# Never interpolate the connection string into a command line -- it carries the
# password and would land in `ps` output and shell history. psql and pg_dump
# both read it from the environment instead.
psql_q() {
    PGCONNECT_TIMEOUT=15 psql "$DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$1"
}

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
    else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# -s, not just -h: on a directory `du -h` prints one line per subdirectory,
# so the storage summary was logging ~40 sizes instead of one total.
human_size() { du -sh "$1" 2>/dev/null | cut -f1; }

# `pg_dump` refuses to dump a server newer than itself, but an OLDER client
# against a newer server can also produce a subtly incomplete dump. Check rather
# than discover it during a restore.
assert_pg_dump_version() {
    local server client
    server="$(psql_q 'SHOW server_version;' | cut -d. -f1 | tr -dc '0-9')"
    client="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
    [ -n "$server" ] || die "Could not read server_version -- is DATABASE_URL reachable?"
    log "postgres server major $server, pg_dump major $client"
    if [ "$client" -lt "$server" ]; then
        die "pg_dump $client is older than the server ($server). Install postgresql-client-$server; a mismatched dump can restore incompletely."
    fi
}
