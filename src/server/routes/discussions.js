import { json } from '../http/responses.js';
import { cachedFor } from '../services/cache.js';
import { findCategory, listCategories } from './categories.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authorSelect = 'id,username,display_name,avatar_url,avatar_color';
const discussionSelect = encodeURIComponent(
  `*,profiles:forum_profiles!forum_discussions_user_id_fkey(${authorSelect}),category:forum_categories(id,name,slug,color)`,
);

/**
 * Leading text of a discussion for list views. Stored content can embed images and files as
 * base64 data, so lists carry this short preview instead of the full body.
 */
function contentPreview(content) {
  const text = String(content || '')
    .replace(/^:::attachment\|.*:::$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .trim();
  return text.length > 400 ? text.slice(0, 400) : text;
}

function listSummary({ content, ...discussion }) {
  return { ...discussion, preview: contentPreview(content) };
}

/** The 50 most recently active discussions, as every visitor sees them. */
function loadDiscussionList(supabase) {
  return cachedFor(supabase, 'discussions', async () => {
    const { body } = await supabase.request(
      `/rest/v1/forum_discussions?select=${discussionSelect}&order=is_pinned.desc,updated_at.desc&limit=50`,
      { method: 'GET' },
    );
    return (body || []).map(listSummary);
  });
}

async function listDiscussions(request, supabase) {
  const [discussions, categories] = await Promise.all([
    loadDiscussionList(supabase),
    listCategories(supabase),
  ]);

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ discussions, categories });

  const { user, token } = await supabase.getUser(request);
  const { body: follows } = await supabase.request(
    `/rest/v1/forum_follows?user_id=eq.${encodeURIComponent(user.id)}&select=discussion_id`,
    { method: 'GET' },
    token,
  );
  const followedIds = new Set(follows.map((follow) => String(follow.discussion_id)));
  return json({
    categories,
    discussions: discussions.map((discussion) => ({
      ...discussion,
      viewer_following: followedIds.has(String(discussion.id)),
    })),
  });
}

/** Threads with large embedded files are loaded fresh each time instead of held in memory. */
const maxCachedThreadSize = 512 * 1024;

function threadSize({ discussion, posts }) {
  return posts.reduce(
    (total, post) => total + String(post.content || '').length,
    String(discussion.content || '').length,
  );
}

/** One discussion with its posts as every visitor sees them, or null when it does not exist. */
function loadDiscussionThread(supabase, discussionId) {
  const id = String(discussionId || '');
  if (!uuidPattern.test(id)) return Promise.resolve(null);
  return cachedFor(
    supabase,
    `discussion:${id}`,
    async () => {
      const postSelect = encodeURIComponent(
        `*,profiles:forum_profiles!forum_posts_user_id_fkey(${authorSelect})`,
      );
      const [{ body: discussions }, { body: posts }] = await Promise.all([
        supabase.request(`/rest/v1/forum_discussions?id=eq.${id}&select=${discussionSelect}`, {
          method: 'GET',
        }),
        supabase.request(
          `/rest/v1/forum_posts?discussion_id=eq.${id}&select=${postSelect}&order=number.asc`,
          { method: 'GET' },
        ),
      ]);
      if (!discussions?.[0]) return null;
      return { discussion: discussions[0], posts: posts || [] };
    },
    { shouldStore: (thread) => !thread || threadSize(thread) <= maxCachedThreadSize },
  );
}

async function getDiscussion(request, discussionId, supabase) {
  const thread = await loadDiscussionThread(supabase, discussionId);
  if (!thread) return json({ error: 'Discussion not found' }, 404);

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json(thread);

  const { user, token } = await supabase.getUser(request);
  const userId = encodeURIComponent(user.id);
  const id = encodeURIComponent(thread.discussion.id);
  const postIds = thread.posts.map((post) => post.id).join(',');
  const [{ body: follows }, { body: likes }] = await Promise.all([
    supabase.request(
      `/rest/v1/forum_follows?user_id=eq.${userId}&discussion_id=eq.${id}&select=discussion_id`,
      { method: 'GET' },
      token,
    ),
    postIds
      ? supabase.request(
          `/rest/v1/forum_likes?user_id=eq.${userId}&post_id=in.(${postIds})&select=post_id`,
          { method: 'GET' },
          token,
        )
      : Promise.resolve({ body: [] }),
  ]);
  const likedIds = new Set((likes || []).map((like) => String(like.post_id)));
  return json({
    discussion: { ...thread.discussion, viewer_following: Boolean(follows?.length) },
    posts: thread.posts.map((post) => ({ ...post, viewer_liked: likedIds.has(String(post.id)) })),
  });
}

async function createDiscussion(request, supabase) {
  const { user, token } = await supabase.getUser(request);
  const input = await request.json().catch(() => ({}));
  const title = String(input.title || '').trim();
  const content = String(input.content || '').trim();
  if (title.length < 6 || title.length > 140 || content.length < 10 || content.length > 2500000) {
    return json({ error: 'The title or content is invalid' }, 422);
  }
  if (!input.category_id) return json({ error: 'Choose a category for the discussion' }, 422);
  const category = await findCategory(supabase, input.category_id, token);
  if (!category) return json({ error: 'The selected category does not exist' }, 422);
  const titleSlug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const slug = `${titleSlug}-${Date.now().toString(36)}`;
  const { body } = await supabase.request(
    '/rest/v1/forum_discussions?select=*',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: user.id,
        category_id: category.id,
        title,
        slug,
        content,
      }),
    },
    token,
  );

  return json({ discussion: body[0] }, 201);
}

async function createReply(request, discussionId, supabase) {
  const { user, token } = await supabase.getUser(request);
  const input = await request.json().catch(() => ({}));
  const content = String(input.content || '').trim();
  if (!content || content.length > 2500000) {
    return json({ error: 'Reply content is invalid' }, 422);
  }
  const encodedId = encodeURIComponent(discussionId);
  const { body: existing } = await supabase.request(
    `/rest/v1/forum_posts?discussion_id=eq.${encodedId}&select=number&order=number.desc&limit=1`,
    { method: 'GET' },
    token,
  );
  const { body } = await supabase.request(
    '/rest/v1/forum_posts?select=*',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        discussion_id: discussionId,
        user_id: user.id,
        content,
        number: (existing[0]?.number || 0) + 1,
      }),
    },
    token,
  );

  return json({ post: body[0] }, 201);
}

async function setFollow(request, discussionId, supabase) {
  const { user, token } = await supabase.getUser(request);
  const discussion = encodeURIComponent(discussionId);
  const userId = encodeURIComponent(user.id);

  if (request.method === 'DELETE') {
    await supabase.request(
      `/rest/v1/forum_follows?discussion_id=eq.${discussion}&user_id=eq.${userId}`,
      { method: 'DELETE' },
      token,
    );
    return json({ following: false });
  }

  await supabase.request(
    '/rest/v1/forum_follows?on_conflict=discussion_id,user_id',
    {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ discussion_id: discussionId, user_id: user.id, mode: 'follow' }),
    },
    token,
  );
  return json({ following: true });
}

async function setLike(request, postId, supabase) {
  const { user, token } = await supabase.getUser(request);
  const post = encodeURIComponent(postId);
  const userId = encodeURIComponent(user.id);

  if (request.method === 'DELETE') {
    await supabase.request(
      `/rest/v1/forum_likes?post_id=eq.${post}&user_id=eq.${userId}`,
      { method: 'DELETE' },
      token,
    );
    return json({ liked: false });
  }

  await supabase.request(
    '/rest/v1/forum_likes?on_conflict=post_id,user_id',
    {
      method: 'POST',
      headers: { prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ post_id: postId, user_id: user.id }),
    },
    token,
  );
  return json({ liked: true });
}

async function incrementView(discussionId, supabase) {
  await supabase.request('/rest/v1/rpc/forum_increment_discussion_view', {
    method: 'POST',
    body: JSON.stringify({ target_id: discussionId }),
  });
  return json({ ok: true });
}

async function handleDiscussionRoute(request, url, supabase) {
  if (url.pathname === '/api/discussions' && request.method === 'GET') {
    return listDiscussions(request, supabase);
  }
  if (url.pathname === '/api/discussions' && request.method === 'POST') {
    return createDiscussion(request, supabase);
  }

  const replyMatch = url.pathname.match(/^\/api\/discussions\/([^/]+)\/posts$/);
  if (replyMatch && request.method === 'POST') {
    return createReply(request, replyMatch[1], supabase);
  }

  const followMatch = url.pathname.match(/^\/api\/discussions\/([^/]+)\/follow$/);
  if (followMatch && ['PUT', 'DELETE'].includes(request.method)) {
    return setFollow(request, followMatch[1], supabase);
  }

  const viewMatch = url.pathname.match(/^\/api\/discussions\/([^/]+)\/view$/);
  if (viewMatch && request.method === 'POST') {
    return incrementView(viewMatch[1], supabase);
  }

  const likeMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/like$/);
  if (likeMatch && ['PUT', 'DELETE'].includes(request.method)) {
    return setLike(request, likeMatch[1], supabase);
  }

  const detailMatch = url.pathname.match(/^\/api\/discussions\/([^/]+)$/);
  if (detailMatch && request.method === 'GET') {
    return getDiscussion(request, detailMatch[1], supabase);
  }

  return null;
}

export { handleDiscussionRoute, loadDiscussionList, loadDiscussionThread };
