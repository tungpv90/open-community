# Flarum Community

A Flarum-inspired community forum built with Next.js 15, Supabase authentication, route-based pages for the forum, accounts, and administration, and a production Docker runtime.

## Features

- Discussion feed, tags, search, sorting, replies, likes, follows, notifications, and dark mode.
- Administration for community settings, appearance, users, groups, tags, discussions, and moderation.
- Shared Supabase accounts with `paddle-nextjs-starter-kit` through `auth.users` and `public.user_roles`.
- Sample discussions when the Supabase API is unavailable.
- Non-root, read-only Docker runtime with a health check.

## Project structure

The application follows the Next.js App Router organization of `paddle-nextjs-starter-kit`. Every screen is its own route:

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

Copy `.env.example` to `.env` and provide the same public Supabase credentials used by the Paddle starter project:

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

Never expose a Supabase service-role key in this project. Run `supabase-schema.sql` against the shared Supabase project, or apply the incremental files in `supabase/migrations/`.

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
