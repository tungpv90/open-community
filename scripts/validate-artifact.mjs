import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const nextRoot = resolve(projectRoot, '.next');
const appPathsPath = resolve(nextRoot, 'server/app-paths-manifest.json');
const routesPath = resolve(nextRoot, 'routes-manifest.json');

await Promise.all([
  access(resolve(nextRoot, 'BUILD_ID')),
  access(resolve(nextRoot, 'static')),
  access(appPathsPath),
  access(routesPath),
]);

const [appPaths, routes] = await Promise.all([
  readFile(appPathsPath, 'utf8').then(JSON.parse),
  readFile(routesPath, 'utf8').then(JSON.parse),
]);

const requiredPages = [
  '/page',
  '/login/page',
  '/signup/page',
  '/forgot-password/page',
  '/reset-password/page',
  '/notifications/page',
  '/discussions/new/page',
  '/discussions/[id]/page',
  '/discussions/[id]/edit/page',
  '/admin/page',
  '/admin/users/page',
  '/admin/groups/page',
  '/admin/discussions/page',
  '/admin/categories/page',
  '/admin/tags/page',
  '/admin/moderation/page',
  '/admin/settings/page',
  '/admin/appearance/page',
  '/admin/header/page',
  '/admin/email/page',
];
for (const page of requiredPages) {
  assert.ok(appPaths[page], `The route ${page} must be present in the Next.js artifact`);
}
assert.ok(
  appPaths['/api/[...path]/route'],
  'The catch-all community API route must be present in the Next.js artifact',
);

const responseHeaders = JSON.stringify(routes.headers || []);
assert.match(responseHeaders, /X-Frame-Options/i);
assert.match(responseHeaders, /Permissions-Policy/i);

console.log(
  `Next.js artifact is valid: ${requiredPages.length} pages, the community API, and security headers`,
);
