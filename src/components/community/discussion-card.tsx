import Link from 'next/link';
import type { CSSProperties } from 'react';

import { RelativeTime } from '@/components/ui/relative-time';
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
          {/* The link covers the whole card (see .discussion-card-link) so any click opens it. */}
          <Link className="discussion-card-link" href={`/discussions/${discussion.id}`}>
            {discussion.title}
          </Link>
        </div>
        {discussion.excerpt ? <p>{discussion.excerpt}</p> : null}
        <div className="discussion-meta">
          {discussion.category ? (
            <span
              className="tag-pill category-pill"
              style={{ '--tag-color': discussion.category.color } as CSSProperties}
            >
              {discussion.category.name}
            </span>
          ) : null}
          <span>{discussion.author.name}</span>
          <RelativeTime value={discussion.createdIso} />
          <span className="meta-replies">
            {discussion.replies} {discussion.replies === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
      <div
        className="discussion-stats"
        aria-label={`${discussion.replies} replies and ${discussion.views} views`}
      >
        <strong>{discussion.replies}</strong>
        <span>{discussion.replies === 1 ? 'reply' : 'replies'}</span>
        <small>
          {discussion.views} {discussion.views === 1 ? 'view' : 'views'}
        </small>
      </div>
    </article>
  );
}
