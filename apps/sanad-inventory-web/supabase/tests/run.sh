#!/usr/bin/env bash
# =====================================================================
# run.sh — execute the RLS authorization suite on a throwaway Postgres
# =====================================================================
# Stands up a disposable local cluster, applies the Supabase scaffolding
# and then the REAL migrations in order, and runs the authorization tests
# as the `authenticated` / `anon` Postgres roles.
#
# It never touches the hosted Supabase project. The cluster lives in a
# temporary directory and is destroyed on exit.
#
# Requires a Postgres 17 server on PATH (e.g. `brew install postgresql@17`)
# or in one of the well-known Homebrew locations probed below.
# =====================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/.."

# Locate a Postgres server. Docker is not required.
for p in \
  /opt/homebrew/opt/postgresql@17/bin \
  /opt/homebrew/opt/postgresql@16/bin \
  /usr/local/opt/postgresql@17/bin \
  /usr/lib/postgresql/17/bin
do
  [ -x "$p/postgres" ] && export PATH="$p:$PATH" && break
done

if ! command -v postgres >/dev/null 2>&1; then
  echo "SKIP: no local Postgres server found." >&2
  echo "      Install one with: brew install postgresql@17" >&2
  exit 2
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/sanad-rls.XXXXXX")"
# initdb requires an empty data directory, so the socket lives beside it.
PGDATA="$WORKDIR/data"
SOCKET="$WORKDIR/sock"
mkdir -p "$SOCKET"

cleanup() {
  pg_ctl -D "$PGDATA" -s -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "==> initialising throwaway cluster ($(postgres --version))"
# Homebrew's postgresql@17 reports a sharedir (share/postgresql@17) that does
# not actually contain postgres.bki — the files live in share/postgresql. Find
# the real one rather than trusting pg_config.
SHAREDIR=""
for candidate in \
  "$(pg_config --sharedir 2>/dev/null || true)" \
  "$(dirname "$(dirname "$(readlink -f "$(command -v initdb)")")")/share/postgresql" \
  "$(dirname "$(dirname "$(readlink -f "$(command -v initdb)")")")/share"
do
  if [ -n "$candidate" ] && [ -f "$candidate/postgres.bki" ]; then
    SHAREDIR="$candidate"
    break
  fi
done

if [ -n "$SHAREDIR" ]; then
  initdb -D "$PGDATA" -U postgres --auth=trust -L "$SHAREDIR" >/dev/null
else
  initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

echo "==> starting"
pg_ctl -D "$PGDATA" -o "-k '$SOCKET' -p 55432 -c listen_addresses=''" -w -s start

export PGHOST="$SOCKET" PGPORT=55432 PGUSER=postgres PGDATABASE=postgres
# `drop ... if exists` on a fresh cluster is expected and noisy.
export PGOPTIONS='-c client_min_messages=warning'
psql -q -c "create database sanad_rls_test" >/dev/null
export PGDATABASE=sanad_rls_test

run_sql() {
  # Result rows are discarded; the suite reports through test.results.
  # Errors still reach stderr, so ON_ERROR_STOP remains effective.
  psql -q -v ON_ERROR_STOP=1 -o /dev/null -f "$1"
}

echo "==> applying Supabase scaffolding (local only)"
run_sql "$HERE/00_supabase_bootstrap.sql"

echo "==> applying migrations"
for f in "$MIGRATIONS"/migrations/*.sql; do
  echo "    - $(basename "$f")"
  run_sql "$f"
done

echo "==> running authorization tests"
run_sql "$HERE/01_authorization_test.sql"

echo "==> running advisor-equivalent checks"
run_sql "$HERE/02_advisor_checks.sql"

# Runs last on purpose: it seeds lab_assets rows, and 01 asserts exact row
# counts that new fixtures would otherwise break.
echo "==> running garment authorization and backfill checks"
run_sql "$HERE/03_garments_test.sql"

echo
psql -q -P pager=off -c "
  select name, expected, actual
  from test.results
  where not passed
  order by seq;
"

TOTAL=$(psql -tAq -c "select count(*) from test.results")
PASSED=$(psql -tAq -c "select count(*) from test.results where passed")
FAILED=$(psql -tAq -c "select count(*) from test.results where not passed")

echo "----------------------------------------"
echo "  RLS authorization tests: $PASSED/$TOTAL passed, $FAILED failed"
echo "----------------------------------------"

[ "$FAILED" = "0" ]
