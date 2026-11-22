import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAdminRoute } from '../src/server/routes/admin.js';

test('admin settings persist header menu configuration', async () => {
  const calls = [];
  const supabase = {
    getAdmin: async () => ({ token: 'admin-token' }),
    request: async (...args) => {
      calls.push(args);
      return { body: [{ key: 'general', value: JSON.parse(args[1].body).value }] };
    },
  };
  const headerMenu = {
    discussions: { label: 'Forum', visible: true },
    resources: { label: 'Docs', url: '/docs', visible: true },
    administration: { label: 'Admin', visible: false },
    custom: [{ label: 'About', url: '/about', visible: true }],
  };
  const headerBrand = { mark: 'OC', name: 'Open Community', tagline: 'Connect' };
  const request = new Request('https://community.example/api/admin/settings', {
    method: 'POST',
    body: JSON.stringify({ headerBrand, headerMenu }),
  });
  const response = await handleAdminRoute(request, new URL(request.url), supabase);

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(calls[0][1].body).value.headerBrand, headerBrand);
  assert.deepEqual(JSON.parse(calls[0][1].body).value.headerMenu, headerMenu);
});
