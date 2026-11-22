# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 App Router community application. Routes, layouts, and route handlers live in `src/app/`; colocate route-specific server actions in `actions.ts`. Reusable UI belongs in `src/components/<feature>/`, shared types and pure helpers in `src/lib/`, external-service and server helpers in `src/utils/`, static values in `src/constants/`, and global styles in `src/styles/`.

Each screen is a route under `src/app/` (forum, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/notifications`, `/discussions/...`, `/admin/...`); keep page files thin and put behavior in `src/components/<feature>/`. Session, configuration, and applied branding come from `CommunityProvider` in `src/components/session/`; use `useCommunity()` rather than reading tokens directly, and call the API through `src/utils/api/client.ts`. Admin pages share data through `AdminDataProvider`; settings are stored as one JSON value, so save through `saveSettings()` which merges changes. Post content is a Markdown subset rendered by `src/lib/rich-content.ts`; never inject user content as HTML any other way. The API handlers live in `src/server/` and are exposed by `src/app/api/[...path]/route.ts`. Database migrations live in `supabase/migrations/`; `supabase-schema.sql` is the consolidated setup reference.

Use the `@/*` alias for imports from `src`.

## Build, Test, and Development Commands

- `npm run dev`: start the Next.js development server.
- `npm run clean`: remove local Next.js build output.
- `npm run check`: type-check, syntax-check JavaScript, and verify formatting.
- `npm run format`: format the repository with Prettier.
- `npm test`: run the Node.js source tests.
- `npm run build`: generate the production Next.js application.
- `npm run validate`: validate the generated routes and security headers.
- `docker compose up -d --build --force-recreate`: rebuild and run the production-style container.
- `docker compose ps`: confirm the container reports `healthy`.

After source or build changes, always rebuild Docker and verify `http://localhost:3000/api/health`.

## Coding Style & Naming Conventions

Write TypeScript and React components with ES modules, semicolons, and two-space indentation. Prettier enforces single quotes, trailing commas, and a 100-character print width. Use PascalCase for React components and camelCase for utilities, hooks, and variables. Use kebab-case for CSS classes and avoid inline styles when a reusable class is appropriate.

Keep API handlers focused and return JSON through the shared response helper while the compatibility API exists. Use the design tokens in `src/styles/globals.css` (for accents, derive from `var(--brand)` so admin-configured colors apply) rather than hardcoded colors.

## Testing Guidelines

The source suite uses the built-in `node:test` runner. Put focused tests in `test/`; import dependency-free TypeScript modules from `src/lib` with `test/helpers/load-typescript.js` (Node 20 cannot strip types). `scripts/validate-artifact.mjs` is the required generated-artifact regression suite; add assertions there for generated routes, headers, or output metadata. For UI changes, test desktop and mobile layouts and include screenshots in the pull request.

## Commit & Pull Request Guidelines

Use short imperative commit summaries and keep each commit to one logical change. Pull requests should explain user impact, list validation commands, link relevant issues, note configuration or schema changes, and include before/after images for visual work.

## Security & Configuration

Copy `.env.example` to `.env`; never commit credentials. Treat `SUPABASE_ANON_KEY` as configuration and keep privileged keys out of browser code. Preserve the non-root, read-only Docker runtime and health check.
