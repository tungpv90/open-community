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

test('discussion lists carry a short preview instead of the full content', async () => {
  const image = `![photo](data:image/png;base64,${'A'.repeat(5000)})`;
  const supabase = {
    request: async (path) => {
      if (path.startsWith('/rest/v1/forum_categories')) return { body: [] };
      return {
        body: [{ id: 'discussion-1', content: `Hello there\n${image}\n${'x'.repeat(900)}` }],
      };
    },
  };
  const message = request('/api/discussions');
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);
  const [discussion] = (await response.json()).discussions;

  assert.equal(discussion.content, undefined);
  assert.ok(discussion.preview.startsWith('Hello there'));
  assert.doesNotMatch(discussion.preview, /base64/);
  assert.ok(discussion.preview.length <= 400);
});

test('a single discussion is returned with its posts and the viewer state', async () => {
  const id = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
  const supabase = {
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    request: async (path) => {
      if (path.startsWith('/rest/v1/forum_discussions')) return { body: [{ id, title: 'Hi' }] };
      if (path.startsWith('/rest/v1/forum_posts')) return { body: [{ id: 'p1' }, { id: 'p2' }] };
      if (path.startsWith('/rest/v1/forum_follows')) return { body: [{ discussion_id: id }] };
      if (path.startsWith('/rest/v1/forum_likes')) return { body: [{ post_id: 'p2' }] };
      throw new Error(`Unexpected request ${path}`);
    },
  };
  const message = request(`/api/discussions/${id}`, {
    headers: { authorization: 'Bearer token' },
  });
  const response = await handleDiscussionRoute(message, new URL(message.url), supabase);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.discussion.viewer_following, true);
  assert.deepEqual(
    data.posts.map((post) => post.viewer_liked),
    [false, true],
  );
});

test('unknown or malformed discussion ids answer 404 without querying', async () => {
  const calls = [];
  const supabase = {
    request: async (...args) => {
      calls.push(args);
      return { body: [] };
    },
  };
  const malformed = request('/api/discussions/not-a-uuid');
  assert.equal(
    (await handleDiscussionRoute(malformed, new URL(malformed.url), supabase)).status,
    404,
  );
  assert.equal(calls.length, 0);

  const missing = request('/api/discussions/6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f');
  assert.equal((await handleDiscussionRoute(missing, new URL(missing.url), supabase)).status, 404);
});
