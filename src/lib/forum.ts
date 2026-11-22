import { contentExcerpt } from '@/lib/rich-content';

export type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
  position?: number;
  /** Number of discussions in the category that the viewer can see. */
  discussion_count?: number;
};

export type ForumAuthor = {
  name: string;
  username?: string;
  initials: string;
  color: string;
};

export type ForumPost = {
  id: string;
  author: ForumAuthor;
  content: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
  /** The discussion's opening content, which is stored on the discussion rather than as a post. */
  isRoot?: boolean;
};

export type ForumDiscussion = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: ForumAuthor;
  /** The discussion's category; absent only for legacy rows. */
  category: ForumCategory | null;
  createdAt: string;
  /** Creation time in epoch milliseconds, when known. */
  createdTime?: number;
  updatedAt: number;
  replies: number;
  views: number;
  pinned: boolean;
  following?: boolean;
};

export function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function excerpt(value: string) {
  return contentExcerpt(value);
}

export function normalizeCategory(input: unknown): ForumCategory | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (!value.id || !value.slug) return null;
  return {
    id: String(value.id),
    name: String(value.name || 'Uncategorized'),
    slug: String(value.slug),
    color: String(value.color || '#e7672e'),
    description: typeof value.description === 'string' ? value.description : undefined,
    position: typeof value.position === 'number' ? value.position : undefined,
    discussion_count:
      typeof value.discussion_count === 'number' ? value.discussion_count : undefined,
  };
}

export function normalizeDiscussion(input: Record<string, any>): ForumDiscussion {
  const profile = input.profiles || {};
  const name = profile.display_name || profile.username || 'Member';

  return {
    id: String(input.id),
    title: input.title || 'Untitled discussion',
    excerpt: excerpt(input.content || ''),
    content: input.content || '',
    author: {
      name,
      username: profile.username || '',
      initials: initials(name),
      color: profile.avatar_color || '#6c5ce7',
    },
    category: normalizeCategory(input.category),
    createdAt: input.created_at
      ? new Date(input.created_at).toLocaleDateString('en-US')
      : 'Recently',
    createdTime: input.created_at ? new Date(input.created_at).getTime() : undefined,
    updatedAt: input.updated_at ? new Date(input.updated_at).getTime() : Date.now(),
    replies: input.reply_count || 0,
    views: input.view_count || 0,
    pinned: Boolean(input.is_pinned),
    following: Boolean(input.viewer_following),
  };
}

/** Prepends the discussion's opening content unless the first reply already repeats it. */
export function withRootPost(discussion: ForumDiscussion, replies: ForumPost[]): ForumPost[] {
  const first = replies[0];
  if (
    first &&
    first.content === discussion.content &&
    first.author.name === discussion.author.name
  ) {
    return replies;
  }
  return [
    {
      id: `root-${discussion.id}`,
      author: discussion.author,
      content: discussion.content,
      createdAt: discussion.createdAt,
      likes: 0,
      isRoot: true,
    },
    ...replies,
  ];
}
