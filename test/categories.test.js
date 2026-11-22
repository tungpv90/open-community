import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handleAdminRoute } from '../src/server/routes/admin.js';
import { handleCategoryRoute } from '../src/server/routes/categories.js';
import { handleDiscussionRoute } from '../src/server/routes/discussions.js';

const categoryId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const schema = await readFile(new URL('../supabase-schema.sql', import.meta.url), 'utf8');

function request(path, init = {}) {
  return new Request(`http://local.test${path}`, init);
}

/** A fake Supabase client that records calls and answers from `routes` (path substring → body). */
function fakeSupabase(routes = {}) {
  const calls = [];
  return {
    calls,
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    getAdmin: async () => ({ user: { id: 'admin-1' }, token: 'Bearer admin' }),
    request: async (path, init = {}) => {
      calls.push([path, init]);
      const match = Object.keys(routes).find((key) => path.includes(key));
      return { body: match ? routes[match] : [] };
    },
  };
}

const validDiscussion = {
  title: 'How do categories work?',
  content: 'Every discussion needs a category now.',
};

test('schema links each discussion to a category that cannot be deleted while used', () => {
  assert.match(schema, /create table if not exists public\.forum_categories/);
  assert.match(
    schema,
    /category_id uuid references public\.forum_categories\(id\) on delete restrict/,
  );
  assert.match(schema, /create policy forum_categories_read on public\.forum_categories/);
});

test('discussion creation requires a category before writing', async () => {
  const supabase = fakeSupabase();
  const message = request('/api/discussions', {
    method: 'POST',
    body: JSON.stringify(validDiscussion),
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /category/i);
  assert.equal(supabase.calls.length, 0);
});

test('discussion creation rejects an unknown category', async () => {
  const supabase = fakeSupabase();
  const message = request('/api/discussions', {
    method: 'POST',
    body: JSON.stringify({ ...validDiscussion, category_id: categoryId }),
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 422);
  assert.ok(!supabase.calls.some(([, init]) => init.method === 'POST'));
});

test('discussion creation stores the chosen category', async () => {
  const supabase = fakeSupabase({
    forum_categories: [{ id: categoryId, name: 'General', slug: 'general', color: '#e7672e' }],
    forum_discussions: [{ id: 'discussion-1' }],
  });
  const message = request('/api/discussions', {
    method: 'POST',
    body: JSON.stringify({ ...validDiscussion, category_id: categoryId }),
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);
  const insert = supabase.calls.find(
    ([path, init]) => path.startsWith('/rest/v1/forum_discussions') && init.method === 'POST',
  );

  assert.equal(response.status, 201);
  assert.equal(JSON.parse(insert[1].body).category_id, categoryId);
});

test('public category list flattens discussion counts', async () => {
  const supabase = fakeSupabase({
    forum_categories: [
      { id: categoryId, name: 'General', slug: 'general', discussions: [{ count: 4 }] },
    ],
  });
  const message = request('/api/categories');
  const response = await handleCategoryRoute(message, new URL(message.url), supabase);
  const data = await response.json();

  assert.equal(data.categories[0].discussion_count, 4);
  assert.equal(data.categories[0].discussions, undefined);
});

test('admin category creation validates and appends after the last position', async () => {
  const supabase = fakeSupabase({ 'order=position.desc': [{ position: 3 }] });
  const message = request('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'Show & Tell', description: '  Projects  ', color: '#336699' }),
  });
  const response = await handleAdminRoute(message, new URL(message.url), supabase);
  const insert = supabase.calls.find(([, init]) => init.method === 'POST');

  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(insert[1].body), {
    name: 'Show & Tell',
    slug: 'show-tell',
    description: 'Projects',
    color: '#336699',
    position: 4,
  });
});

test('admin category creation rejects a duplicate slug', async () => {
  const supabase = fakeSupabase({ 'slug=eq.general': [{ id: categoryId }] });
  const message = request('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: 'General' }),
  });
  const response = await handleAdminRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 409);
});

test('admin cannot delete a category that still has discussions', async () => {
  const supabase = fakeSupabase({ 'forum_discussions?category_id': [{ id: 'discussion-1' }] });
  const message = request(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
  const response = await handleAdminRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 409);
  assert.ok(!supabase.calls.some(([, init]) => init.method === 'DELETE'));
});

test('admin can move a discussion to another category', async () => {
  const supabase = fakeSupabase({
    forum_categories: [{ id: categoryId }],
    forum_discussions: [{ id: 'discussion-1' }],
  });
  const message = request('/api/admin/discussions/discussion-1', {
    method: 'PATCH',
    body: JSON.stringify({ ...validDiscussion, category_id: categoryId }),
  });
  const response = await handleAdminRoute(message, new URL(message.url), supabase);
  const patch = supabase.calls.find(([, init]) => init.method === 'PATCH');

  assert.equal(response.status, 200);
  assert.equal(JSON.parse(patch[1].body).category_id, categoryId);
});
