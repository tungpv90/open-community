#!/usr/bin/env bash
# Applies the database schema and pending migrations to the Supabase Postgres database.
#
#   DATABASE_URL=postgresql://... bash scripts/migrate.sh
#
# A fresh database gets supabase-schema.sql (which already contains every migration).
# Each file in supabase/migrations/ then runs once, in name order, inside a transaction,
# and is recorded in public.schema_migrations.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the Supabase Postgres connection string}"
cd "$(dirname "$0")/.."

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

psql_run() {
  psql "$DATABASE_URL" --no-psqlrc --quiet --set ON_ERROR_STOP=1 "$@"
}

scalar() {
  psql_run --tuples-only --no-align --command "$1"
}

tracking_exists=$(scalar "select to_regclass('public.schema_migrations') is not null")
forum_exists=$(scalar "select to_regclass('public.forum_profiles') is not null")

psql_run <<'SQL'
set client_min_messages = warning;
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
SQL

record_all_migrations() {
  for file in supabase/migrations/*.sql; do
    version=$(basename "$file" .sql)
    echo "insert into public.schema_migrations(version) values (:'version') on conflict do nothing;" |
      psql_run --set version="$version"
  done
}

if [ "$forum_exists" != "t" ]; then
  echo "Fresh database: applying supabase-schema.sql"
  psql_run --single-transaction --file supabase-schema.sql
  record_all_migrations
elif [ "$tracking_exists" != "t" ]; then
  # The schema was set up by hand before migrations were tracked; it already includes them.
  echo "Existing database without migration history: recording current migrations as applied"
  record_all_migrations
fi

applied=0
for file in supabase/migrations/*.sql; do
  version=$(basename "$file" .sql)
  done_already=$(echo "select exists(select 1 from public.schema_migrations where version = :'version');" |
    psql_run --tuples-only --no-align --set version="$version")
  [ "$done_already" = "t" ] && continue

  echo "Applying $version"
  {
    cat "$file"
    printf "\ninsert into public.schema_migrations(version) values ('%s');\n" "$version"
  } | psql_run --single-transaction
  applied=$((applied + 1))
done

psql_run --command "notify pgrst, 'reload schema'"
echo "Database is up to date ($applied new migration(s))."
