import assert from 'node:assert/strict';
import test from 'node:test';
import { handleNotificationRoute } from '../src/server/routes/notifications.js';

test('the unread endpoint counts only unread notifications for the viewer', async () => {
  const calls = [];
  const supabase = {
    getUser: async () => ({ user: { id: 'user-1' }, token: 'Bearer token' }),
    request: async (path) => {
      calls.push(path);
      return { body: [{ id: 1 }, { id: 2 }] };
    },
  };
  const message = new Request('http://local.test/api/notifications/unread', {
    headers: { authorization: 'Bearer token' },
  });
  const response = await handleNotificationRoute(message, new URL(message.url), supabase);

  assert.deepEqual(await response.json(), { unread: 2 });
  assert.match(calls[0], /user_id=eq\.user-1/);
  assert.match(calls[0], /is_read=eq\.false/);
  assert.match(calls[0], /select=id/);
});
