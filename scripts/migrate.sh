#!/usr/bin/env bash
# Applies the database schema and pending migrations to the Supabase Postgres database.
#
#   DATABASE_URL=postgresql://... bash scripts/migrate.sh
#   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> bash scripts/migrate.sh
#
# With DATABASE_URL the SQL runs through psql; otherwise it runs through the Supabase
# Management API with a personal access token (no database password needed).
#
# A fresh database gets supabase-schema.sql (which already contains every migration).
# Each file in supabase/migrations/ then runs once, in name order, inside a transaction,
# and is recorded in public.schema_migrations.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "${DATABASE_URL:-}" ]; then
  # Tolerate common copy-paste noise: surrounding whitespace or quotes, or a KEY= prefix.
  DATABASE_URL=$(printf '%s' "$DATABASE_URL" | tr -d '\r\n' |
    sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^[A-Z_]+=//; s/^["'\'']//; s/["'\'']$//')
  case "$DATABASE_URL" in
    postgres://* | postgresql://*) ;;
    *)
      echo "DATABASE_URL must start with postgresql:// (got ${#DATABASE_URL} characters" \
        "starting with '$(printf '%s' "$DATABASE_URL" | cut -c1-4)…')." >&2
      exit 1
      ;;
  esac
  case "$DATABASE_URL" in
    *'[YOUR-PASSWORD]'*)
      echo "DATABASE_URL still contains the [YOUR-PASSWORD] placeholder." >&2
      exit 1
      ;;
  esac

  # Runs the SQL on stdin in one transaction.
  sql_exec() {
    psql "$DATABASE_URL" --no-psqlrc --quiet --set ON_ERROR_STOP=1 --single-transaction
  }
  # Prints the single value returned by the query on stdin.
  sql_value() {
    psql "$DATABASE_URL" --no-psqlrc --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align
  }
elif [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  api="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query"
  sql_api() {
    local body response status
    body=$(jq -Rs '{query: .}')
    response=$(curl -sS -w '\n%{http_code}' -X POST "$api" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data-binary "$body")
    status=${response##*$'\n'}
    response=${response%$'\n'*}
    if [ "${status:0:1}" != 2 ]; then
      echo "Supabase Management API returned HTTP $status: $response" >&2
      return 1
    fi
    printf '%s' "$response"
  }
  sql_exec() {
    { echo 'begin;'; cat; printf '\ncommit;\n'; } | sql_api >/dev/null
  }
  sql_value() {
    sql_api | jq -r 'if type == "array" and length > 0 then (.[0] | to_entries[0].value | tostring) else "" end'
  }
else
  echo "Set DATABASE_URL, or SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF." >&2
  exit 1
fi

yes_no() {
  echo "select case when ($1) then 'yes' else 'no' end;" | sql_value
}

tracking_exists=$(yes_no "to_regclass('public.schema_migrations') is not null")
forum_exists=$(yes_no "to_regclass('public.forum_profiles') is not null")

sql_exec <<'SQL'
set local client_min_messages = warning;
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
SQL

migration_version() {
  local version
  version=$(basename "$1" .sql)
  case "$version" in
    *[!A-Za-z0-9_-]*)
      echo "Migration file names may only use letters, digits, _ and -: $1" >&2
      exit 1
      ;;
  esac
  printf '%s' "$version"
}

record_all_migrations() {
  local file
  for file in supabase/migrations/*.sql; do
    echo "insert into public.schema_migrations(version) values ('$(migration_version "$file")') on conflict do nothing;"
  done | sql_exec
}

if [ "$forum_exists" != "yes" ]; then
  echo "Fresh database: applying supabase-schema.sql"
  sql_exec < supabase-schema.sql
  record_all_migrations
elif [ "$tracking_exists" != "yes" ]; then
  # The schema was set up by hand before migrations were tracked; it already includes them.
  echo "Existing database without migration history: recording current migrations as applied"
  record_all_migrations
fi

applied=0
for file in supabase/migrations/*.sql; do
  version=$(migration_version "$file")
  [ "$(yes_no "exists(select 1 from public.schema_migrations where version = '$version')")" = yes ] &&
    continue

  echo "Applying $version"
  {
    cat "$file"
    printf "\ninsert into public.schema_migrations(version) values ('%s');\n" "$version"
  } | sql_exec
  applied=$((applied + 1))
done

echo "notify pgrst, 'reload schema';" | sql_exec
echo "Database is up to date ($applied new migration(s))."
