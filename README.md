# Flarum Community

A Flarum-inspired community forum built with Next.js 15, Supabase authentication, route-based pages for the forum, accounts, and administration, and a production Docker runtime.

## Features

- Discussion feed, tags, search, sorting, replies, likes, follows, notifications, and dark mode.
- Administration for community settings, appearance, users, groups, tags, discussions, and moderation.
- Accounts in a dedicated Supabase project (`auth.users`), with administrators listed in `public.user_roles`.
- Sample discussions when the Supabase API is unavailable.
- Non-root, read-only Docker runtime with a health check.

## Project structure

The application uses the Next.js App Router. Every screen is its own route:

```text
src/
  app/
    page.tsx                   /                      Discussion feed
    login/, signup/            /login, /signup        Email and OAuth sign-in (supports ?next=)
    forgot-password/           /forgot-password       Request a reset link
    reset-password/            /reset-password        Choose a new password from the email link
    notifications/             /notifications
    discussions/new/           /discussions/new
    discussions/[id]/          /discussions/:id       Discussion, replies, likes, follow
    discussions/[id]/edit/     /discussions/:id/edit  Admin-only editing
    admin/                     /admin, /admin/users, /admin/groups, /admin/discussions,
                               /admin/tags, /admin/moderation, /admin/settings,
                               /admin/appearance, /admin/header, /admin/email
    api/[...path]/route.ts     JSON API (delegates to src/server/routes)
  components/                  React components by feature (admin, community, editor, session, ui)
  lib/                         Shared types and pure helpers (rich content, settings, forum data)
  server/                      API route handlers and the Supabase client
  utils/api/client.ts          Browser API client with session storage and token refresh
  styles/                      Global and feature stylesheets
supabase/migrations/           Incremental database migrations
test/                          Node.js source tests
scripts/                       Validation and operational tooling
```

`CommunityProvider` (`src/components/session/`) loads `/api/config` and `/api/me`, applies admin-configured branding and colors, and stores sessions returned by Supabase OAuth, email confirmation, or password recovery links on any page.

Password recovery emails redirect to `${PUBLIC_SITE_URL}/reset-password`; add that URL to the Supabase Auth redirect allow list.

## Requirements

- Node.js 20 or newer.
- Docker Engine with Docker Compose for production-style deployment.
- A Supabase project for persistent accounts and forum data.

## Configuration

Copy `.env.example` to `.env` and provide the public credentials of the community's Supabase project:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
PUBLIC_SITE_URL=http://localhost:3000
AUTH_OAUTH_PROVIDERS=google,facebook,linkedin
TURNSTILE_SITE_KEY=
PORT=3000
```

### Signup spam protection

Registration works without email confirmation, so signups are protected in three layers:

- **Captcha:** create a Cloudflare Turnstile widget, set its site key as `TURNSTILE_SITE_KEY`, and enter its secret in Supabase **Authentication → Attack Protection → Captcha** (provider Turnstile). Supabase then rejects every signup without a valid token, including direct calls with the public anon key. Leave the variable empty to disable the challenge (local development).
- **Honeypot:** the signup form has a hidden `website` field; requests that fill it get a fake success and create nothing.
- **New-account limits:** accounts younger than 24 hours may start 3 discussions and write 10 posts per hour, enforced by a database trigger (`supabase/migrations/20261122010000_new_account_limits.sql`).

Never expose a Supabase service-role key in this project. For a new Supabase project, run `supabase-schema.sql` once; existing databases apply the incremental files in `supabase/migrations/`. After the first administrator signs up, promote them with the `user_roles` insert at the end of `supabase-schema.sql`.

## Development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Before handing off a change, run:

```sh
npm run format
npm run check
npm test
npm run build
npm run validate
```

## Docker deployment

```sh
docker compose up -d --build --force-recreate
docker compose ps
```

The container serves the Next.js standalone build on port `3000`. Verify it with:

```sh
curl http://localhost:3000/api/health
```

The expected response reports `status: "ok"` and whether Supabase is configured.

The published port listens on `127.0.0.1` only (`FORUM_BIND`), so production traffic goes through a reverse proxy. For example, with `FORUM_PORT=9081` and `PUBLIC_SITE_URL=https://community.example.com`:

```nginx
location / {
  proxy_pass http://127.0.0.1:9081;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Add `${PUBLIC_SITE_URL}` and `${PUBLIC_SITE_URL}/reset-password` to Supabase **Authentication → URL Configuration**.

### Deploy from GitHub

Everything runs from **Actions → Deploy → Run workflow** (`.github/workflows/deploy.yml`); no manual server or database steps are needed. Each run:

1. Applies database changes with `scripts/migrate.sh`: a fresh database gets `supabase-schema.sql`, then every file in `supabase/migrations/` runs once and is recorded in `public.schema_migrations`.
2. Sets the Supabase Auth Site URL and adds the site to the redirect allow list.
3. Uploads the selected commit over SSH, installs Docker on the server if it is missing, writes the server `.env`, rebuilds the container, and waits for it to report healthy.
4. Checks `/api/health` on the server and on the public URL.

Add these to the repository's `production` environment (Settings → Environments) once:

| Kind     | Name                                         | Value                                                                                    |
| -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Secret   | `DEPLOY_HOST`                                | Server address                                                                           |
| Secret   | `DEPLOY_SSH_KEY` or `DEPLOY_PASSWORD`        | SSH private key (public half in `authorized_keys`) or the SSH password                   |
| Secret   | `DEPLOY_USER`, `DEPLOY_PORT`                 | Optional, default `root` and `22`                                                        |
| Secret   | `DEPLOY_KNOWN_HOSTS`                         | Recommended: `ssh-keyscan -t ed25519 <host>` output, checked by hand                     |
| Secret   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`          | Public Supabase client credentials                                                       |
| Secret   | `SUPABASE_DB_URL`                            | **Session pooler** connection string (Connect → Session pooler); runners lack IPv6       |
| Secret   | `SUPABASE_ACCESS_TOKEN`                      | Optional personal access token to set the Auth URLs; otherwise set them in the dashboard |
| Variable | `PUBLIC_SITE_URL`                            | Optional, default `https://community.apaxsoft.com`                                       |
| Variable | `FORUM_PORT`, `DEPLOY_PATH`                  | Optional, default `9081` and `/opt/open-community`                                       |
| Variable | `AUTH_OAUTH_PROVIDERS`, `TURNSTILE_SITE_KEY` | Optional, same meaning as in `.env`                                                      |

New database changes go in a new `supabase/migrations/<timestamp>_<name>.sql` file; also fold them into `supabase-schema.sql` so fresh databases match.
