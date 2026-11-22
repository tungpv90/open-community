import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDiscussionRoute } from '../src/server/routes/discussions.js';

function request(path, init = {}) {
  return new Request(`http://local.test${path}`, init);
}

test('discussion creation rejects invalid content before writing', async () => {
  const calls = [];
  const supabase = {
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    request: async (...args) => {
      calls.push(args);
      return { body: [] };
    },
  };
  const message = request('/api/discussions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Short', content: 'tiny' }),
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 422);
  assert.equal(calls.length, 0);
});

test('authenticated discussion lists include the viewer follow state', async () => {
  const supabase = {
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    request: async (path) => {
      if (path.includes('forum_follows')) return { body: [{ discussion_id: 'discussion-1' }] };
      return { body: [{ id: 'discussion-1' }, { id: 'discussion-2' }] };
    },
  };
  const message = request('/api/discussions', {
    headers: { authorization: 'Bearer token' },
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);
  const data = await response.json();

  assert.equal(data.discussions[0].viewer_following, true);
  assert.equal(data.discussions[1].viewer_following, false);
});

test('like endpoint writes an idempotent user-post relation', async () => {
  const calls = [];
  const supabase = {
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    request: async (...args) => {
      calls.push(args);
      return { body: [] };
    },
  };
  const message = request('/api/posts/post-1/like', { method: 'PUT' });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);

  assert.equal(response.status, 200);
  assert.match(calls[0][0], /forum_likes\?on_conflict=post_id,user_id/);
  assert.equal(calls[0][1].headers.prefer, 'resolution=ignore-duplicates');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    post_id: 'post-1',
    user_id: 'user-1',
  });
});
