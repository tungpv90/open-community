'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { DiscussionCard } from '@/components/community/discussion-card';
import { useCommunity } from '@/components/session/community-provider';
import { defaultWelcome } from '@/lib/community-settings';
import { normalizeCategory, normalizeDiscussion } from '@/lib/forum';
import type { ForumCategory, ForumDiscussion, ForumTag } from '@/lib/forum';
import { api, errorMessage } from '@/utils/api/client';

type Filter = 'all' | 'following' | 'unanswered' | 'popular';
type Sort = 'latest' | 'newest' | 'top';

/** Keeps the selected category in the address bar so the view can be shared and restored. */
function writeCategoryParam(slug: string) {
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set('category', slug);
  else url.searchParams.delete('category');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

export function ForumHome() {
  const { settings, user } = useCommunity();
  const [loadError, setLoadError] = useState('');
  const [discussions, setDiscussions] = useState<ForumDiscussion[]>([]);
  const [tags, setTags] = useState<ForumTag[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCategory(new URLSearchParams(window.location.search).get('category') || '');
  }, []);

  useEffect(() => {
    api<{ discussions: Record<string, any>[]; tags: ForumTag[]; categories?: unknown[] }>(
      '/api/discussions',
    )
      .then((result) => {
        setDiscussions(result.discussions.map(normalizeDiscussion));
        setCategories(
          (result.categories || [])
            .map(normalizeCategory)
            .filter((item): item is ForumCategory => Boolean(item)),
        );
        setTags(result.tags || []);
        setLoadError('');
      })
      .catch((error) => setLoadError(errorMessage(error, 'Could not load discussions')))
      .finally(() => setLoading(false));
  }, [user]);

  const activeCategory = categories.find((item) => item.slug === category);

  const visible = useMemo(() => {
    let result = discussions.filter((discussion) => {
      if (activeCategory && discussion.category?.slug !== activeCategory.slug) return false;
      if (tag && discussion.tag?.slug !== tag) return false;
      if (filter === 'following' && !discussion.following) return false;
      if (filter === 'unanswered' && discussion.replies > 0) return false;
      if (filter === 'popular' && discussion.views < 250) return false;
      if (query) {
        const haystack =
          `${discussion.title} ${discussion.excerpt} ${discussion.author.name}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === 'top') return b.views - a.views;
      if (sort === 'newest') {
        return (b.createdTime ?? b.updatedAt) - (a.createdTime ?? a.updatedAt);
      }
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return result;
  }, [activeCategory, discussions, filter, query, sort, tag]);

  const replies = discussions.reduce((total, discussion) => total + discussion.replies, 0);
  const trending = [...discussions].sort((a, b) => b.views - a.views).slice(0, 3);

  function selectCategory(slug: string) {
    setCategory(slug);
    writeCategoryParam(slug);
  }

  function selectFilter(next: Filter) {
    setFilter(next);
    setTag('');
    selectCategory('');
  }

  return (
    <main className="forum-layout">
      <aside className="forum-sidebar">
        <Link className="button button-primary button-block" href="/discussions/new">
          Start a discussion
        </Link>
        <nav className="filter-nav" aria-label="Discussion filters">
          {(
            [
              ['all', 'All discussions'],
              ['following', 'Following'],
              ['unanswered', 'Unanswered'],
              ['popular', 'Popular'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={filter === value && !tag && !category ? 'active' : ''}
              type="button"
              onClick={() => selectFilter(value)}
              key={value}
            >
              <span>{value === 'unanswered' ? '?' : value === 'following' ? '☆' : '◉'}</span>
              {label}
              {value === 'all' ? <small>{discussions.length}</small> : null}
            </button>
          ))}
        </nav>

        {categories.length ? (
          <>
            <h2 className="sidebar-title">Categories</h2>
            <nav className="filter-nav category-nav" aria-label="Discussion categories">
              {categories.map((item) => (
                <button
                  className={category === item.slug ? 'active' : ''}
                  type="button"
                  aria-pressed={category === item.slug}
                  title={item.description || undefined}
                  onClick={() => {
                    selectCategory(category === item.slug ? '' : item.slug);
                    setTag('');
                    setFilter('all');
                  }}
                  key={item.id}
                >
                  <i style={{ backgroundColor: item.color }} />
                  {item.name}
                  <small>{item.discussion_count ?? 0}</small>
                </button>
              ))}
            </nav>
          </>
        ) : null}

        {tags.length ? (
          <>
            <h2 className="sidebar-title">Browse by tag</h2>
            <nav className="filter-nav tag-nav" aria-label="Discussion tags">
              {tags.map((item) => (
                <button
                  className={tag === item.slug ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setTag(item.slug);
                    setFilter('all');
                    selectCategory('');
                  }}
                  key={item.slug}
                >
                  <i style={{ backgroundColor: item.color }} />
                  {item.name}
                </button>
              ))}
            </nav>
          </>
        ) : null}

        <section className="sidebar-callout">
          <strong>Make the community better</strong>
          <p>Share what you know, stay curious, and help someone move forward today.</p>
        </section>
      </aside>

      <section className="forum-feed">
        <section className="forum-hero">
          <span>Open community</span>
          <h1>{String(settings.welcome || defaultWelcome)}</h1>
          <p>
            Ask thoughtful questions, share what you have learned, and follow the conversations that
            matter to you.
          </p>
          <div>
            <button type="button" onClick={() => selectFilter('unanswered')}>
              Help answer a question
            </button>
            <button type="button" onClick={() => selectFilter('popular')}>
              Explore popular topics
            </button>
          </div>
        </section>

        <div className="feed-toolbar">
          <div>
            <h2>
              {activeCategory
                ? activeCategory.name
                : tag
                  ? tags.find((item) => item.slug === tag)?.name
                  : filter === 'all'
                    ? 'All discussions'
                    : filter[0].toUpperCase() + filter.slice(1)}
            </h2>
            <p>{activeCategory?.description || 'Fresh conversations from across the community'}</p>
          </div>
          <label className="feed-search">
            <span className="sr-only">Search discussions</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label="Sort discussions"
          >
            <option value="latest">Recently active</option>
            <option value="newest">Newest first</option>
            <option value="top">Most viewed</option>
          </select>
        </div>

        {loadError ? (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="discussion-grid" aria-busy={loading}>
          {loading ? (
            <div className="empty-state">
              <p>Loading discussions…</p>
            </div>
          ) : visible.length ? (
            visible.map((discussion) => (
              <DiscussionCard discussion={discussion} key={discussion.id} />
            ))
          ) : loadError ? null : discussions.length ? (
            <div className="empty-state">
              <h3>No discussions found</h3>
              <p>Try another filter or start a new conversation.</p>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No discussions yet</h3>
              <p>Be the first to start a conversation in this community.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="forum-rail">
        <section className="rail-card">
          <h2>Community pulse</h2>
          <div className="pulse-grid">
            <div>
              <strong>{discussions.length}</strong>
              <span>discussions</span>
            </div>
            <div>
              <strong>{replies}</strong>
              <span>replies</span>
            </div>
          </div>
          <p className="community-ready">
            <i />
            Community is ready
          </p>
        </section>
        {trending.length ? (
          <section className="rail-card">
            <h2>Trending this week</h2>
            <div className="trending-list">
              {trending.map((discussion) => (
                <Link href={`/discussions/${discussion.id}`} key={discussion.id}>
                  <strong>{discussion.title}</strong>
                  <span>{discussion.views} views</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </main>
  );
}
