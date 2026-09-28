#!/usr/bin/env bash
# Generate lib/database.types.ts from the schema, or check it is current.
#
#   npm run db:types         # after `bash scripts/ci/e2e-db.sh start`
#   npm run db:types:check   # exit 1 if the committed types have drifted
#
# From the LOCAL test database, which is built from the committed baseline
# (scripts/ci/e2e-db.sh). So the types describe exactly the schema in
# supabase/migrations/00000000000000_baseline.sql, which `npm run db:schema:check`
# keeps equal to production. The flow after a migration: apply it,
# `npm run db:schema`, restart the local database, `npm run db:types`.
set -euo pipefail

cd "$(dirname "$0")/../.."
OUT=lib/database.types.ts
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

npx -y supabase@2.118.0 gen types typescript --local --workdir tests/e2e/db --schema public 2>/dev/null > "$TMP"

if [ "${1:-}" = "--check" ]; then
  if ! diff -q <(tr -d '\r' < "$TMP") <(tr -d '\r' < "$OUT") > /dev/null; then
    echo "$OUT is not what the schema generates. Run: npm run db:types" >&2
    diff <(tr -d '\r' < "$TMP") <(tr -d '\r' < "$OUT") | head -40 >&2
    exit 1
  fi
  echo "$OUT matches the schema."
else
  cp "$TMP" "$OUT"
  echo "Wrote $OUT ($(wc -l < "$OUT") lines)."
fi
