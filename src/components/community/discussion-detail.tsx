'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';

import { RichContent, RichEditor } from '@/components/editor/rich-editor';
import { useCommunity } from '@/components/session/community-provider';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RelativeTime } from '@/components/ui/relative-time';
import { initials, normalizeDiscussion, withRootPost } from '@/lib/forum';
import type { ForumDiscussion, ForumPost } from '@/lib/forum';
import { api, ApiError, errorMessage } from '@/utils/api/client';

type RemotePost = {
  id: string;
  user_id?: string;
  content: string;
  created_at?: string;
  like_count?: number;
  viewer_liked?: boolean;
  is_hidden?: boolean;
  profiles?: { display_name?: string; username?: string; avatar_color?: string };
};

function normalizePost(post: RemotePost): ForumPost {
  const name = post.profiles?.display_name || post.profiles?.username || 'Member';
  return {
    id: String(post.id),
    content: post.content || '',
    createdIso: post.created_at,
    likes: post.like_count || 0,
    liked: post.viewer_liked,
    author: {
      name,
      username: post.profiles?.username,
      initials: initials(name),
      color: post.profiles?.avatar_color || '#6c5ce7',
    },
  };
}

/** Counts one view per discussion per browser session. */
function recordView(discussionId: string) {
  const key = `community_viewed_${discussionId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without storage, still count the view once for this page load.
  }
  void api(`/api/discussions/${encodeURIComponent(discussionId)}/view`, {
    method: 'POST',
    body: '{}',
  }).catch(() => undefined);
}

type Thread = { discussion: Record<string, any>; posts: RemotePost[] };

function visiblePosts(posts: RemotePost[]) {
  return posts.filter((post) => !post.is_hidden).map(normalizePost);
}

export function DiscussionDetail({
  discussionId,
  initialThread,
}: {
  discussionId: string;
  /** The anonymous view rendered on the server; undefined when it could not be loaded there. */
  initialThread?: Record<string, any> | null;
}) {
  const router = useRouter();
  const { ready, user, isAdmin } = useCommunity();
  const initial = initialThread as Thread | null | undefined;
  const [discussion, setDiscussion] = useState<ForumDiscussion | null>(() =>
    initial ? normalizeDiscussion(initial.discussion) : null,
  );
  const [posts, setPosts] = useState<ForumPost[]>(() =>
    initial ? visiblePosts(initial.posts) : [],
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>(
    initial ? 'ready' : 'loading',
  );
  const [loadError, setLoadError] = useState('');
  const [reply, setReply] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const encodedId = encodeURIComponent(discussionId);
  // The server already rendered what anonymous visitors see; only signed-in viewers reload.
  const serverDataFresh = useRef(Boolean(initial));
  const userId = user?.id || '';

  const loadThread = useCallback(async () => {
    const thread = await api<Thread>(`/api/discussions/${encodedId}`);
    setDiscussion(normalizeDiscussion(thread.discussion));
    setPosts(visiblePosts(thread.posts));
    setStatus('ready');
  }, [encodedId]);

  useEffect(() => {
    if (initial) recordView(discussionId);
    // Runs once per discussion; `initial` belongs to that discussion.
  }, [discussionId]);

  useEffect(() => {
    if (!ready) return;
    if (!userId && serverDataFresh.current) {
      serverDataFresh.current = false;
      return;
    }
    const firstLoad = !serverDataFresh.current && status === 'loading';
    serverDataFresh.current = false;
    let cancelled = false;
    loadThread()
      .then(() => {
        if (firstLoad && !cancelled) recordView(discussionId);
      })
      .catch((loadFailure) => {
        if (cancelled) return;
        if (loadFailure instanceof ApiError && loadFailure.status === 404) {
          setStatus('missing');
          return;
        }
        // Keep showing the server-rendered thread if only the personalised reload failed.
        if (discussion) return;
        setLoadError(errorMessage(loadFailure, 'Could not load this discussion'));
        setStatus('failed');
      });
    return () => {
      cancelled = true;
    };
    // Reload only when the viewer changes; status and discussion are read for the first load.
  }, [discussionId, loadThread, ready, userId]);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) {
      setError('Write a reply before posting.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/api/discussions/${encodedId}/posts`, {
        method: 'POST',
        body: JSON.stringify({ content: reply }),
      });
      setReply('');
      setEditorKey((key) => key + 1);
      // The reply is saved; a failed refresh only delays showing it.
      await loadThread().catch(() => undefined);
    } catch (submitError) {
      setError(errorMessage(submitError, 'Could not post reply'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    if (!discussion) return;
    if (!user) return router.push(`/login?next=/discussions/${encodedId}`);
    const following = !discussion.following;
    try {
      await api(`/api/discussions/${encodedId}/follow`, { method: following ? 'PUT' : 'DELETE' });
      setDiscussion({ ...discussion, following });
    } catch (followError) {
      setError(errorMessage(followError, 'Could not update follow status'));
    }
  }

  async function toggleLike(post: ForumPost) {
    if (!user) return router.push(`/login?next=/discussions/${encodedId}`);
    const liked = !post.liked;
    try {
      await api(`/api/posts/${encodeURIComponent(post.id)}/like`, {
        method: liked ? 'PUT' : 'DELETE',
      });
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
            : item,
        ),
      );
    } catch (likeError) {
      setError(errorMessage(likeError, 'Could not update like'));
    }
  }

  async function deleteDiscussion() {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api(`/api/admin/discussions/${encodedId}`, { method: 'DELETE' });
      router.push('/');
    } catch (removeError) {
      setDeleteError(errorMessage(removeError, 'Could not delete this discussion'));
      setDeleteBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className="content-page discussion-page">
        <div className="empty-state" aria-busy="true">
          <p>Loading discussion…</p>
        </div>
      </main>
    );
  }

  if (status === 'failed') {
    return (
      <main className="content-page">
        <div className="empty-state">
          <h1>Discussion unavailable</h1>
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <Link className="button button-primary" href="/">
            Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'missing' || !discussion) {
    return (
      <main className="content-page">
        <div className="empty-state not-found">
          <span>404</span>
          <h1>Discussion not found</h1>
          <p>This conversation may have been removed or never existed.</p>
          <Link className="button button-primary" href="/">
            Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  const canManage = isAdmin && status === 'ready';

  return (
    <main className="content-page discussion-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Discussions</Link>
        <span aria-hidden="true">/</span>
        {discussion.category ? (
          <Link href={`/?category=${encodeURIComponent(discussion.category.slug)}`}>
            {discussion.category.name}
          </Link>
        ) : null}
      </nav>
      <header className="discussion-header">
        <div>
          {discussion.category ? (
            <span
              className="tag-pill category-pill"
              style={{ '--tag-color': discussion.category.color } as CSSProperties}
            >
              {discussion.category.name}
            </span>
          ) : null}
          <h1>{discussion.title}</h1>
          <p>
            Started by {discussion.author.name} · <RelativeTime value={discussion.createdIso} /> ·{' '}
            {discussion.views} {discussion.views === 1 ? 'view' : 'views'} · {discussion.replies}{' '}
            {discussion.replies === 1 ? 'reply' : 'replies'}
          </p>
        </div>
        <div className="discussion-actions">
          {canManage ? (
            <>
              <Link className="button" href={`/discussions/${encodedId}/edit`}>
                Edit
              </Link>
              <button
                className="button danger-text"
                type="button"
                onClick={() => setDeleting(true)}
              >
                Delete
              </button>
            </>
          ) : null}
          {status === 'ready' ? (
            <button
              className={discussion.following ? 'button button-primary' : 'button'}
              type="button"
              aria-pressed={Boolean(discussion.following)}
              onClick={toggleFollow}
            >
              {discussion.following ? 'Following' : 'Follow'}
            </button>
          ) : null}
        </div>
      </header>

      <section className="post-list" aria-label="Posts">
        {withRootPost(discussion, posts).map((post, index) => (
          <article className="post-card" key={post.id} id={`post-${index + 1}`}>
            <aside>
              <span className="avatar" style={{ backgroundColor: post.author.color }}>
                {post.author.initials}
              </span>
              <strong>{post.author.name}</strong>
              <small>{post.author.name === discussion.author.name ? 'Author' : 'Member'}</small>
            </aside>
            <div className="post-body">
              <header>
                <RelativeTime value={post.createdIso} />
                <a href={`#post-${index + 1}`}>#{index + 1}</a>
              </header>
              <RichContent className="post-content" value={post.content} />
              {status === 'ready' && !post.isRoot ? (
                <footer>
                  <button
                    type="button"
                    className={post.liked ? 'liked' : ''}
                    aria-pressed={Boolean(post.liked)}
                    onClick={() => toggleLike(post)}
                  >
                    ♥ {post.likes || 'Like'}
                  </button>
                </footer>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {status === 'ready' && user ? (
        <form className="reply-card" onSubmit={submitReply}>
          <h2>Join the conversation</h2>
          <p>Be constructive, stay on topic, and help move the discussion forward.</p>
          <RichEditor
            key={editorKey}
            id="reply-editor"
            label="Reply"
            placeholder="Write a thoughtful reply…"
            onChange={setReply}
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="reply-actions">
            <span>Replying as {user.profile?.display_name || user.email}</span>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'Posting…' : 'Post reply'}
            </button>
          </div>
        </form>
      ) : null}

      {status === 'ready' && !user ? (
        <section className="reply-card reply-signin">
          <h2>Join the conversation</h2>
          <p>Log in or create an account to reply, like posts, and follow this discussion.</p>
          <div className="reply-actions">
            <Link className="button" href={`/signup?next=/discussions/${encodedId}`}>
              Create an account
            </Link>
            <Link className="button button-primary" href={`/login?next=/discussions/${encodedId}`}>
              Log in to reply
            </Link>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={deleting}
        title="Delete this discussion?"
        message={`“${discussion.title}” and all of its replies will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete discussion"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={deleteDiscussion}
        onCancel={() => {
          setDeleting(false);
          setDeleteError('');
        }}
      />
    </main>
  );
}
