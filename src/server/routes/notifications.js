import { json } from '../http/responses.js';

async function handleNotificationRoute(request, url, supabase) {
  const unreadOnly = url.pathname === '/api/notifications/unread';
  if (url.pathname !== '/api/notifications' && !unreadOnly) return null;

  const { user, token } = await supabase.getUser(request);
  const userId = encodeURIComponent(user.id);

  if (unreadOnly) {
    if (request.method !== 'GET') return null;
    // The header badge shows "9+" beyond nine, so ten rows are enough to count.
    const { body } = await supabase.request(
      `/rest/v1/forum_notifications?user_id=eq.${userId}&is_read=eq.false&select=id&limit=10`,
      { method: 'GET' },
      token,
    );
    return json({ unread: body.length });
  }

  if (request.method === 'GET') {
    const { body } = await supabase.request(
      `/rest/v1/forum_notifications?user_id=eq.${userId}&select=*&order=created_at.desc&limit=30`,
      { method: 'GET' },
      token,
    );
    return json({ notifications: body });
  }

  if (request.method === 'PATCH') {
    await supabase.request(
      `/rest/v1/forum_notifications?user_id=eq.${userId}&is_read=eq.false`,
      { method: 'PATCH', body: JSON.stringify({ is_read: true }) },
      token,
    );
    return json({ ok: true });
  }

  return null;
}

export { handleNotificationRoute };
