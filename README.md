# Flarum Community

A lightweight Flarum-inspired community forum with a Node.js runtime, Supabase authentication, a complete administration interface, Docker deployment, and OpenAI Sites compatibility.

## Features

- Discussion feed, tags, search, sorting, replies, likes, follows, notifications, and dark mode.
- Administration for users, groups, permissions, tags, moderation, appearance, email, extensions, and advanced settings.
- Shared Supabase accounts with the `paddle-nextjs-starter-kit` project through `auth.users` and `public.user_roles`.
- Demo mode backed by browser storage when Supabase is not configured.
- Production-ready Docker image running as a non-root user with a read-only filesystem and health checks.

## Project structure

The repository keeps editable source separate from generated deployment output:

```text
src/
  index.html       Page structure and accessible content
  styles/
    base.css       Shared component foundations
    community.css  Design tokens and responsive community theme
  app.js           Browser interactions and forum state
worker/
  api.js           API routes and Supabase integration
scripts/
  build.mjs        Generates the deployable Worker artifact
  dev.mjs          Builds once, then starts the local server
dist/              Generated output; never edit directly
```

UI work belongs in `src/`, backend work belongs in `worker/api.js`, and `npm run build` composes both into a single deployment artifact. This keeps Docker and OpenAI Sites on the same tested build path.

## Requirements

- Node.js 20 or newer for local development.
- Docker Engine with Docker Compose for container deployment.
- A Supabase project for persistent accounts and forum data.

## Configuration

Copy the example file and provide the same public Supabase credentials used by the `paddle-nextjs-starter-kit` project:

```sh
cp .env.example .env
```

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
FORUM_PORT=3000
```

Run [supabase-schema.sql](./supabase-schema.sql) against that Supabase project. It adds only `forum_*` tables and reuses the existing `auth.users`, `public.user_roles`, and `public.is_admin()` objects.

## Local Node.js development

```sh
npm run dev
```

Open `http://localhost:3000`. Useful checks:

```sh
npm run check
npm run build
npm run validate
```

## Docker deployment

Build and start the production container:

```sh
docker compose up -d --build
```

Or use the deployment helper:

```sh
sh scripts/deploy.sh up
```

On Windows PowerShell:

```powershell
.\scripts\deploy.ps1 up
```

Operational commands:

```sh
sh scripts/deploy.sh status
sh scripts/deploy.sh logs
sh scripts/deploy.sh restart
sh scripts/deploy.sh down
```

The health endpoint is `GET /api/health`. Docker maps `${FORUM_PORT:-3000}` on the host to port `3000` in the container.

## Updating production

1. Pull the new source revision.
2. Keep production values in the ignored `.env` file or in the host's secret manager.
3. Run `sh scripts/deploy.sh up` or `.\scripts\deploy.ps1 up`.
4. Confirm `docker compose ps` reports the service as healthy.

The deploy helper rebuilds the image, recreates the service, removes orphaned containers, and preserves the configured restart policy.

## OpenAI Sites

`npm run build` creates the Worker artifact in `dist/`. `npm run validate` verifies the Sites entry point. Generated `dist/` and `outputs/` directories are intentionally excluded from Git.
