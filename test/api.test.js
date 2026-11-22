import assert from 'node:assert/strict';
import test from 'node:test';

import { handleApiRequest } from '../src/server/routes/index.js';

function call(path, environment = {}, init = {}) {
  const request = new Request(`http://local.test${path}`, init);
  return handleApiRequest(request, environment, new URL(request.url));
}

test('health endpoint works without Supabase configuration', async () => {
  const response = await call('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'flarum-community',
    supabase: 'demo',
  });
});

test('public configuration is safe in demo mode', async () => {
  const response = await call('/api/config');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: false,
    settings: {},
    auth_providers: [],
  });
});

test('data routes explain that Supabase is not configured', async () => {
  const response = await call('/api/discussions');

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
});

test('API responses are never cached', async () => {
  const response = await call('/api/health');

  assert.equal(response.headers.get('cache-control'), 'no-store');
});
