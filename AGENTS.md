# Repository Guidelines

## Project Structure & Module Organization

Editable browser code lives in `src/`: `index.html` defines page structure, `app.js` contains forum interactions, and `styles/` separates shared foundations from the community theme. API routes and Supabase integration belong in `worker/api.js`. `server.mjs` adapts the Worker interface for local Node.js and Docker use.

Build and operational tooling lives in `scripts/`. `scripts/build.mjs` combines the source and API into the generated `dist/server/index.js`; never edit `dist/` directly. Database setup is documented in `supabase-schema.sql`. Local QA artifacts belong in ignored `outputs/`.

## Build, Test, and Development Commands

- `npm run dev`: build once and start the watched local server.
- `npm start`: build and run the server without watch mode.
- `npm run check`: syntax-check browser, API, and server JavaScript.
- `npm run build`: generate the deployable Worker artifact in `dist/`.
- `npm run validate`: verify the artifact and smoke-test HTML, CSS, JavaScript, and health routes.
- `docker compose up -d --build --force-recreate`: rebuild and run the production-style container.
- `docker compose ps`: confirm the container reports `healthy`.

After source or build changes, always rebuild Docker and verify `http://localhost:3000/api/health`.

## Coding Style & Naming Conventions

Use ES modules, semicolons, and two-space indentation in new JavaScript. Prefer `camelCase` for variables and functions, `PascalCase` only for constructors, and kebab-case for CSS classes. Keep API handlers focused and return JSON through the shared response helper. Preserve the design tokens in `src/styles/community.css`; avoid inline styles when a reusable class is appropriate.

No formatter or linter is configured. Match adjacent code and run `npm run check` before committing.

## Testing Guidelines

There is no standalone test framework or coverage threshold. `scripts/validate-artifact.mjs` is the required regression suite. Add Node assertions there for new routes, headers, caching rules, or generated markup. For UI changes, test desktop and mobile layouts and include screenshots in the pull request.

## Commit & Pull Request Guidelines

History uses short imperative summaries such as `Update Site source`. Keep subjects concise and scope each commit to one logical change. Pull requests should explain the user impact, list validation commands, link relevant issues, note configuration or schema changes, and include before/after images for visual work.

## Security & Configuration

Copy `.env.example` to `.env`; never commit credentials. Treat `SUPABASE_ANON_KEY` as configuration and keep privileged keys out of browser code. Preserve the non-root, read-only Docker runtime and health check.
