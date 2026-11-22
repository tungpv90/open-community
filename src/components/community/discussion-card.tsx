import Link from 'next/link';

import type { ForumDiscussion } from '@/lib/forum';

export function DiscussionCard({ discussion }: { discussion: ForumDiscussion }) {
  return (
    <article className="discussion-card">
      <span className="avatar" style={{ backgroundColor: discussion.author.color }}>
        {discussion.author.initials}
      </span>
      <div className="discussion-copy">
        <div className="discussion-title-row">
          {discussion.pinned ? (
            <span className="pin" title="Pinned">
              ●
            </span>
          ) : null}
          <Link href={`/discussions/${discussion.id}`}>{discussion.title}</Link>
        </div>
        <p>{discussion.excerpt}</p>
        <div className="discussion-meta">
          {discussion.category ? (
            <span
              className="tag-pill category-pill"
              style={{ '--tag-color': discussion.category.color } as React.CSSProperties}
            >
              {discussion.category.name}
            </span>
          ) : null}
          <span>{discussion.author.name}</span>
          <span>{discussion.createdAt}</span>
        </div>
      </div>
      <div
        className="discussion-stats"
        aria-label={`${discussion.replies} replies and ${discussion.views} views`}
      >
        <strong>{discussion.replies}</strong>
        <span>replies</span>
        <small>{discussion.views} views</small>
      </div>
    </article>
  );
}
