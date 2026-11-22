import assert from 'node:assert/strict';
import test from 'node:test';
import { cached, cachedFor, clearCache } from '../src/server/services/cache.js';
import { handleApiRequest } from '../src/server/routes/index.js';

test('cached values are reused and concurrent misses share one load', async () => {
  clearCache();
  let loads = 0;
  const loader = async () => {
    loads += 1;
    return { value: loads };
  };
  const [first, second] = await Promise.all([cached('shared', loader), cached('shared', loader)]);
  const third = await cached('shared', loader);

  assert.equal(loads, 1);
  assert.equal(first, second);
  assert.equal(third, first);
});

test('stale values are served while a background refresh runs', async () => {
  clearCache();
  let loads = 0;
  const loader = async () => ++loads;
  const options = { freshMs: 0, staleMs: 60_000 };

  assert.equal(await cached('stale', loader, options), 1);
  assert.equal(await cached('stale', loader, options), 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await cached('stale', loader, options), 2);
});

test('failed loads are not cached', async () => {
  clearCache();
  await assert.rejects(
    cached('failing', async () => {
      throw new Error('offline');
    }),
  );
  assert.equal(await cached('failing', async () => 'recovered'), 'recovered');
});

test('a load that finishes after the cache was cleared is not stored', async () => {
  clearCache();
  let release;
  const slow = cached('race', () => new Promise((resolve) => (release = resolve)));
  await new Promise((resolve) => setImmediate(resolve));
  clearCache();
  release('before the write');
  assert.equal(await slow, 'before the write');
  assert.equal(await cached('race', async () => 'after the write'), 'after the write');
});

test('clients without a cache key always load fresh data', async () => {
  let loads = 0;
  await cachedFor({}, 'key', async () => ++loads);
  await cachedFor({}, 'key', async () => ++loads);
  assert.equal(loads, 2);
});

test('writes through the API clear cached public data', async () => {
  clearCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'nope' }, { status: 401 });
  try {
    await cached('https://example.supabase.co:settings', async () => 'old');
    const environment = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
    };
    const request = new Request('http://local.test/api/discussions', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: '{}',
    });
    await handleApiRequest(request, environment, new URL(request.url));
    assert.equal(await cached('https://example.supabase.co:settings', async () => 'new'), 'new');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
