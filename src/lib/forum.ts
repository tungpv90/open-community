import { contentExcerpt } from '@/lib/rich-content';

export type ForumTag = {
  id?: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
};

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
  tag: ForumTag;
  /** The discussion's category; absent only for sample data or legacy rows. */
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

export const defaultTags: ForumTag[] = [
  { name: 'Announcements', slug: 'announcements', color: '#6c5ce7' },
  { name: 'Development', slug: 'development', color: '#20b486' },
  { name: 'Lifestyle', slug: 'lifestyle', color: '#f59e55' },
  { name: 'Sharing', slug: 'sharing', color: '#ef5b6a' },
  { name: 'Q&A', slug: 'q-and-a', color: '#4a90e2' },
];

export const demoDiscussions: ForumDiscussion[] = [
  {
    id: 'd1',
    title: 'Welcome to Flarum Community!',
    excerpt: 'Introduce yourself and share what you hope to find in the community.',
    content:
      'Hello everyone!\n\nThis is a space to exchange knowledge, experience, and interesting ideas. Please keep conversations friendly, useful, and respectful.',
    author: { name: 'An Nguyễn', username: 'annguyen', initials: 'AN', color: '#6c5ce7' },
    tag: defaultTags[0],
    category: null,
    createdAt: '2 hours ago',
    updatedAt: Date.now() - 7_200_000,
    replies: 18,
    views: 342,
    pinned: true,
    following: true,
  },
  {
    id: 'd2',
    title: 'A web development roadmap for beginners',
    excerpt:
      'A practical collection of HTML, CSS, and JavaScript resources for every learning stage.',
    content:
      'Start with HTML and CSS fundamentals, move to JavaScript and the DOM, then build three complete projects. Shipping real work is the fastest teacher.',
    author: { name: 'Minh Hoàng', username: 'minhhoang', initials: 'MH', color: '#20b486' },
    tag: defaultTags[1],
    category: null,
    createdAt: '4 hours ago',
    updatedAt: Date.now() - 14_400_000,
    replies: 26,
    views: 587,
    pinned: false,
    following: true,
  },
  {
    id: 'd3',
    title: 'Showcase: Your minimalist workspace',
    excerpt: 'Share your workspace and the tools that help you focus every day.',
    content:
      'A workspace does not need many things, but it should make you want to sit down and begin. What keyboard, monitor, and layout do you use?',
    author: { name: 'Khánh Linh', username: 'khanhlinh', initials: 'KL', color: '#f59e55' },
    tag: defaultTags[2],
    category: null,
    createdAt: 'Yesterday',
    updatedAt: Date.now() - 86_400_000,
    replies: 33,
    views: 761,
    pinned: false,
  },
  {
    id: 'd4',
    title: 'How do you manage time and avoid distractions?',
    excerpt: 'Share the deep-work methods, Pomodoro routines, and small habits that actually work.',
    content:
      'Notifications and small tasks often pull me away. Recently I started dividing my day into 90-minute blocks and checking messages twice a day.',
    author: { name: 'Quang Trần', username: 'quangtran', initials: 'QT', color: '#ef5b6a' },
    tag: defaultTags[3],
    category: null,
    createdAt: '2 days ago',
    updatedAt: Date.now() - 172_800_000,
    replies: 12,
    views: 290,
    pinned: false,
  },
  {
    id: 'd5',
    title: 'Q&A: Which framework should I choose?',
    excerpt: 'React, Vue, Svelte, or plain JavaScript? Compare them against real project needs.',
    content:
      'I am building a personal expense tracker. It should be lightweight, easy to deploy, and maintainable. What would you choose?',
    author: { name: 'Bảo Phạm', username: 'baopham', initials: 'BP', color: '#4a90e2' },
    tag: defaultTags[4],
    category: null,
    createdAt: '3 days ago',
    updatedAt: Date.now() - 259_200_000,
    replies: 0,
    views: 146,
    pinned: false,
  },
];

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
  const linkedTag = input.discussion_tags?.[0]?.tags;
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
    tag: linkedTag || defaultTags[1],
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
