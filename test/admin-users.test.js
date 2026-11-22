import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleAdminRoute } from '../src/server/routes/admin.js';

const schema = await readFile(new URL('../supabase-schema.sql', import.meta.url), 'utf8');

test('admin user list is sourced from every Supabase Auth user', () => {
  assert.match(schema, /from auth\.users u/);
  assert.match(schema, /u\.email_confirmed_at/);
});

test('admin can update a user display name, role, and status', async () => {
  const userId = '57c2c5eb-f35e-4c85-bb55-e74a61dd215d';
  const calls = [];
  const supabase = {
    getAdmin: async () => ({ token: 'Bearer admin-token' }),
    request: async (...args) => {
      calls.push(args);
      return { body: [] };
    },
  };
  const request = new Request(`https://community.example/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      display_name: 'Updated Member',
      role: 'moderator',
      status: 'suspended',
    }),
  });
  const response = await handleAdminRoute(request, new URL(request.url), supabase);
  const profileCall = calls.find(([path]) => path.startsWith('/rest/v1/forum_profiles'));

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(profileCall[1].body), {
    display_name: 'Updated Member',
    forum_role: 'moderator',
    status: 'suspended',
  });
});

test('admin can confirm a Supabase email through the protected RPC', async () => {
  const userId = '57c2c5eb-f35e-4c85-bb55-e74a61dd215d';
  const calls = [];
  const supabase = {
    getAdmin: async () => ({ token: 'Bearer admin-token' }),
    request: async (...args) => {
      calls.push(args);
      return { body: true };
    },
  };
  const request = new Request(`https://community.example/api/admin/users/${userId}/confirm`, {
    method: 'POST',
    body: '{}',
  });
  const response = await handleAdminRoute(request, new URL(request.url), supabase);

  assert.equal(response.status, 200);
  assert.equal(calls[0][0], '/rest/v1/rpc/forum_admin_confirm_user');
  assert.deepEqual(JSON.parse(calls[0][1].body), { target_user_id: userId });
  assert.equal(calls[0][2], 'Bearer admin-token');
});

test('admin confirm endpoint rejects malformed user IDs before the RPC', async () => {
  const supabase = {
    getAdmin: async () => ({ token: 'Bearer admin-token' }),
    request: async () => assert.fail('RPC should not be called'),
  };
  const request = new Request('https://community.example/api/admin/users/not-a-uuid/confirm', {
    method: 'POST',
    body: '{}',
  });
  const response = await handleAdminRoute(request, new URL(request.url), supabase);

  assert.equal(response.status, 422);
});
