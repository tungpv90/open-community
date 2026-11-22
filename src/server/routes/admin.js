import { json } from '../http/responses.js';
import { findCategory, listCategories, parseCategoryInput } from './categories.js';

async function handleAdminOverview(request, supabase) {
  const { token } = await supabase.getAdmin(request);
  const [users, discussions, posts, tags, groups, reports, settings, categories] =
    await Promise.all([
      supabase.request('/rest/v1/rpc/forum_admin_users', { method: 'POST', body: '{}' }, token),
      supabase.request('/rest/v1/forum_discussions?select=id', { method: 'GET' }, token),
      supabase.request('/rest/v1/forum_posts?select=id', { method: 'GET' }, token),
      supabase.request('/rest/v1/forum_tags?select=*&order=position.asc', { method: 'GET' }, token),
      supabase.request(
        '/rest/v1/forum_groups?select=*&order=created_at.asc',
        { method: 'GET' },
        token,
      ),
      supabase.request(
        '/rest/v1/forum_reports?select=*&order=created_at.desc&limit=50',
        { method: 'GET' },
        token,
      ),
      supabase.request('/rest/v1/forum_settings?select=*', { method: 'GET' }, token),
      listCategories(supabase, token),
    ]);

  return json({
    users: users.body,
    discussion_count: discussions.body.length,
    post_count: posts.body.length,
    tags: tags.body,
    categories,
    groups: groups.body,
    reports: reports.body,
    settings: settings.body,
  });
}

async function saveAdminSettings(request, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json();
  const { body } = await supabase.request(
    '/rest/v1/forum_settings?on_conflict=key',
    {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ key: 'general', value: input }),
    },
    token,
  );

  return json({ settings: body[0] });
}

async function updateAdminUser(request, userId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json();
  const profilePatch = {};

  if (Object.prototype.hasOwnProperty.call(input, 'display_name')) {
    const displayName = String(input.display_name || '').trim();
    if (!displayName || displayName.length > 80) {
      return json({ error: 'Display name must be between 1 and 80 characters' }, 422);
    }
    profilePatch.display_name = displayName;
  }
  if (['moderator', 'member'].includes(input.role)) {
    profilePatch.forum_role = input.role;
  }
  if (['active', 'suspended', 'banned'].includes(input.status)) {
    profilePatch.status = input.status;
  }
  if (Object.keys(profilePatch).length) {
    await supabase.request(
      `/rest/v1/forum_profiles?id=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify(profilePatch) },
      token,
    );
  }
  if (['admin', 'moderator', 'member'].includes(input.role)) {
    await supabase.request(
      '/rest/v1/user_roles?on_conflict=user_id',
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          role: input.role === 'admin' ? 'admin' : 'user',
        }),
      },
      token,
    );
  }

  return json({ ok: true });
}

async function confirmAdminUser(request, userId, supabase) {
  const { token } = await supabase.getAdmin(request);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: 'User ID is invalid' }, 422);
  }

  const { body: confirmed } = await supabase.request(
    '/rest/v1/rpc/forum_admin_confirm_user',
    {
      method: 'POST',
      body: JSON.stringify({ target_user_id: userId }),
    },
    token,
  );

  return confirmed ? json({ ok: true }) : json({ error: 'User not found' }, 404);
}

async function updateDiscussion(request, discussionId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json();
  const title = String(input.title || '').trim();
  const content = String(input.content || '').trim();

  if (title.length < 6 || title.length > 140 || content.length < 10) {
    return json({ error: 'The title or content is invalid' }, 422);
  }

  const patch = { title, content, updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input, 'category_id')) {
    const category = await findCategory(supabase, input.category_id, token);
    if (!category) return json({ error: 'The selected category does not exist' }, 422);
    patch.category_id = category.id;
  }

  const id = encodeURIComponent(discussionId);
  const { body } = await supabase.request(
    `/rest/v1/forum_discussions?id=eq.${id}&select=*`,
    {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(patch),
    },
    token,
  );

  if (!body[0]) {
    return json({ error: 'Discussion not found' }, 404);
  }

  return json({ discussion: body[0] });
}

async function deleteDiscussion(request, discussionId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const id = encodeURIComponent(discussionId);

  await supabase.request(
    `/rest/v1/forum_posts?discussion_id=eq.${id}`,
    { method: 'DELETE' },
    token,
  );
  await supabase.request(
    `/rest/v1/forum_discussion_tags?discussion_id=eq.${id}`,
    { method: 'DELETE' },
    token,
  );
  await supabase.request(`/rest/v1/forum_discussions?id=eq.${id}`, { method: 'DELETE' }, token);

  return json({ ok: true });
}

async function createTag(request, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json().catch(() => ({}));
  const name = String(input.name || '').trim();
  const slug = String(input.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  if (name.length < 2 || !slug) return json({ error: 'Tag name and slug are required' }, 422);
  const { body } = await supabase.request(
    '/rest/v1/forum_tags?select=*',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        name,
        slug,
        color: input.color || '#e7672e',
        description: input.description || '',
      }),
    },
    token,
  );

  return json({ tag: body[0] }, 201);
}

async function updateTag(request, tagId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json().catch(() => ({}));
  const name = String(input.name || '').trim();
  const slug = String(input.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  if (name.length < 2 || !slug) return json({ error: 'Tag name and slug are required' }, 422);
  const { body } = await supabase.request(
    `/rest/v1/forum_tags?id=eq.${encodeURIComponent(tagId)}&select=*`,
    {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ name, slug, color: input.color || '#e7672e' }),
    },
    token,
  );
  return body[0] ? json({ tag: body[0] }) : json({ error: 'Tag not found' }, 404);
}

async function saveCategory(request, categoryId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const parsed = parseCategoryInput(await request.json().catch(() => ({})));
  if (parsed.error) return json({ error: parsed.error }, 422);

  const slug = encodeURIComponent(parsed.values.slug);
  const { body: clashes } = await supabase.request(
    `/rest/v1/forum_categories?slug=eq.${slug}&select=id`,
    { method: 'GET' },
    token,
  );
  if (clashes.some((row) => String(row.id) !== String(categoryId))) {
    return json({ error: 'Another category already uses this slug' }, 409);
  }

  if (categoryId) {
    const { body } = await supabase.request(
      `/rest/v1/forum_categories?id=eq.${encodeURIComponent(categoryId)}&select=*`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify(parsed.values),
      },
      token,
    );
    return body[0] ? json({ category: body[0] }) : json({ error: 'Category not found' }, 404);
  }

  const { body: last } = await supabase.request(
    '/rest/v1/forum_categories?select=position&order=position.desc&limit=1',
    { method: 'GET' },
    token,
  );
  const { body } = await supabase.request(
    '/rest/v1/forum_categories?select=*',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ ...parsed.values, position: (last[0]?.position || 0) + 1 }),
    },
    token,
  );
  return json({ category: body[0] }, 201);
}

async function deleteCategory(request, categoryId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const id = encodeURIComponent(categoryId);
  const { body: inUse } = await supabase.request(
    `/rest/v1/forum_discussions?category_id=eq.${id}&select=id&limit=1`,
    { method: 'GET' },
    token,
  );
  if (inUse.length) {
    return json(
      { error: 'Move or delete the discussions in this category before deleting it' },
      409,
    );
  }
  const { body } = await supabase.request(
    `/rest/v1/forum_categories?id=eq.${id}&select=id`,
    { method: 'DELETE', headers: { prefer: 'return=representation' } },
    token,
  );
  return body[0] ? json({ ok: true }) : json({ error: 'Category not found' }, 404);
}

async function saveGroup(request, groupId, supabase) {
  const { token } = await supabase.getAdmin(request);
  const input = await request.json().catch(() => ({}));
  const name = String(input.name || '').trim();
  if (name.length < 2) return json({ error: 'Group name is required' }, 422);
  const path = groupId
    ? `/rest/v1/forum_groups?id=eq.${encodeURIComponent(groupId)}&select=*`
    : '/rest/v1/forum_groups?select=*';
  const { body } = await supabase.request(
    path,
    {
      method: groupId ? 'PATCH' : 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ name, color: input.color || '#667d99' }),
    },
    token,
  );
  return body[0]
    ? json({ group: body[0] }, groupId ? 200 : 201)
    : json({ error: 'Group not found' }, 404);
}

async function moderateReport(request, reportId, supabase) {
  const { user, token } = await supabase.getAdmin(request);
  const input = await request.json().catch(() => ({}));
  if (!['dismiss', 'remove'].includes(input.action)) {
    return json({ error: 'Moderation action is invalid' }, 422);
  }
  const id = encodeURIComponent(reportId);
  const { body: reports } = await supabase.request(
    `/rest/v1/forum_reports?id=eq.${id}&select=*`,
    { method: 'GET' },
    token,
  );
  const report = reports[0];
  if (!report) return json({ error: 'Report not found' }, 404);

  if (input.action === 'remove') {
    if (report.post_id)
      await supabase.request(
        `/rest/v1/forum_posts?id=eq.${encodeURIComponent(report.post_id)}`,
        { method: 'PATCH', body: JSON.stringify({ is_hidden: true }) },
        token,
      );
    if (report.discussion_id)
      await supabase.request(
        `/rest/v1/forum_discussions?id=eq.${encodeURIComponent(report.discussion_id)}`,
        { method: 'PATCH', body: JSON.stringify({ is_hidden: true }) },
        token,
      );
  }
  await supabase.request(
    `/rest/v1/forum_reports?id=eq.${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: input.action === 'dismiss' ? 'dismissed' : 'resolved',
        handled_by: user.id,
        handled_at: new Date().toISOString(),
      }),
    },
    token,
  );
  return json({ ok: true });
}

async function handleAdminRoute(request, url, supabase) {
  if (url.pathname === '/api/admin/overview' && request.method === 'GET') {
    return handleAdminOverview(request, supabase);
  }
  if (url.pathname === '/api/admin/settings' && request.method === 'POST') {
    return saveAdminSettings(request, supabase);
  }
  if (url.pathname === '/api/admin/tags' && request.method === 'POST') {
    return createTag(request, supabase);
  }
  if (url.pathname === '/api/admin/categories' && request.method === 'POST') {
    return saveCategory(request, null, supabase);
  }
  if (url.pathname === '/api/admin/groups' && request.method === 'POST') {
    return saveGroup(request, null, supabase);
  }

  const tagMatch = url.pathname.match(/^\/api\/admin\/tags\/([^/]+)$/);
  if (tagMatch && request.method === 'PATCH') {
    return updateTag(request, tagMatch[1], supabase);
  }

  const categoryMatch = url.pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (categoryMatch && request.method === 'PATCH') {
    return saveCategory(request, categoryMatch[1], supabase);
  }
  if (categoryMatch && request.method === 'DELETE') {
    return deleteCategory(request, categoryMatch[1], supabase);
  }

  const groupMatch = url.pathname.match(/^\/api\/admin\/groups\/([^/]+)$/);
  if (groupMatch && request.method === 'PATCH') {
    return saveGroup(request, groupMatch[1], supabase);
  }

  const reportMatch = url.pathname.match(/^\/api\/admin\/reports\/([^/]+)$/);
  if (reportMatch && request.method === 'PATCH') {
    return moderateReport(request, reportMatch[1], supabase);
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === 'PATCH') {
    return updateAdminUser(request, userMatch[1], supabase);
  }

  const confirmUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/confirm$/);
  if (confirmUserMatch && request.method === 'POST') {
    return confirmAdminUser(request, confirmUserMatch[1], supabase);
  }

  const discussionMatch = url.pathname.match(/^\/api\/admin\/discussions\/([^/]+)$/);
  if (discussionMatch && request.method === 'PATCH') {
    return updateDiscussion(request, discussionMatch[1], supabase);
  }
  if (discussionMatch && request.method === 'DELETE') {
    return deleteDiscussion(request, discussionMatch[1], supabase);
  }

  return null;
}

export { handleAdminRoute };
