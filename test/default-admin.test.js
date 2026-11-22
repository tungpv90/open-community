import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handleAuthRoute } from '../src/server/routes/auth.js';

const schema = await readFile(new URL('../supabase-schema.sql', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../supabase/migrations/20261123000000_default_admin.sql', import.meta.url),
  'utf8',
);

/** Answers /api/me lookups as `role`, with the password check returning `required`. */
function meSupabase(role, required) {
  const calls = [];
  return {
    calls,
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer user-token' }),
    request: async (path, init = {}, token) => {
      calls.push([path, init, token]);
      if (path.startsWith('/rest/v1/user_roles')) return { body: role ? [{ role }] : [] };
      if (path.startsWith('/rest/v1/rpc/forum_password_change_required')) {
        return { body: required };
      }
      return { body: [{ id: 'user-1', forum_role: 'member' }] };
    },
  };
}

async function me(supabase) {
  const request = new Request('https://community.example/api/me');
  const response = await handleAuthRoute(request, new URL(request.url), supabase, {});
  return (await response.json()).user;
}

test('the default administrator is created once and promoted, in schema and migration', () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /admin_email constant text := 'admin@apaxsoft\.com'/);
    assert.match(sql, /extensions\.crypt\('admin@12345', extensions\.gen_salt\('bf', 10\)\)/);
    assert.match(sql, /if admin_id is null then/);
    assert.match(
      sql,
      /insert into public\.user_roles\(user_id, role\) values \(admin_id, 'admin'\)/,
    );
    assert.match(sql, /function public\.forum_password_change_required\(\)/);
  }
});

test('administrators on the initial password must change it', async () => {
  const supabase = meSupabase('admin', true);
  const user = await me(supabase);
  assert.equal(user.role, 'admin');
  assert.equal(user.password_change_required, true);
  const rpc = supabase.calls.find(([path]) => path.includes('forum_password_change_required'));
  assert.equal(rpc[1].method, 'POST');
  assert.equal(rpc[2], 'Bearer user-token');
});

test('administrators with a changed password open the console', async () => {
  assert.equal((await me(meSupabase('admin', false))).password_change_required, false);
});

test('members are never asked to change the administrator password', async () => {
  const supabase = meSupabase(null, true);
  assert.equal((await me(supabase)).password_change_required, false);
  assert.ok(!supabase.calls.some(([path]) => path.includes('forum_password_change_required')));
});
