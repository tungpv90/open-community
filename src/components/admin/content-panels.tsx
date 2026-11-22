'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  ActionMessage,
  AdminPage,
  PageHeading,
  useAdminAction,
  useAdminData,
} from '@/components/admin/admin-data';
import type { AdminReport, AdminTag } from '@/components/admin/admin-data';
import { ColorField } from '@/components/admin/form-controls';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeDiscussion } from '@/lib/forum';
import type { ForumDiscussion } from '@/lib/forum';
import { api, errorMessage } from '@/utils/api/client';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function DiscussionsPanel() {
  const { reload } = useAdminData();
  const [discussions, setDiscussions] = useState<ForumDiscussion[] | null>(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<ForumDiscussion | null>(null);
  const { busy, message, setMessage, run } = useAdminAction();

  const load = useCallback(async () => {
    try {
      const result = await api<{ discussions: Record<string, any>[] }>('/api/discussions');
      setDiscussions(result.discussions.map(normalizeDiscussion));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load discussions'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!target) return;
    const removed = target;
    const ok = await run(async () => {
      await api(`/api/admin/discussions/${encodeURIComponent(removed.id)}`, { method: 'DELETE' });
      await Promise.all([load(), reload()]);
    }, `“${removed.title}” deleted`);
    if (ok) setTarget(null);
  }

  return (
    <AdminPage>
      {() => (
        <>
          <PageHeading
            eyebrow="Content"
            title="Discussions"
            copy="Review, edit, and remove conversations across the community."
            action={
              <Link className="button button-primary" href="/discussions/new">
                New discussion
              </Link>
            }
          />
          {target ? null : <ActionMessage message={message} />}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <section className="admin-card table-card">
            <div className="admin-table discussion-admin-table">
              <div className="table-row table-head">
                <span>Discussion</span>
                <span>Category</span>
                <span>Replies</span>
                <span>Views</span>
                <span>Actions</span>
              </div>
              {discussions === null ? (
                <div className="admin-loading">Loading discussions…</div>
              ) : discussions.length ? (
                discussions.map((item) => (
                  <div className="table-row" key={item.id}>
                    <span className="user-cell">
                      <Link href={`/discussions/${encodeURIComponent(item.id)}`}>{item.title}</Link>
                      <small>
                        by {item.author.name} · {item.createdAt}
                      </small>
                    </span>
                    <span>
                      {item.category ? (
                        <>
                          <i className="tag-dot" style={{ backgroundColor: item.category.color }} />
                          {item.category.name}
                        </>
                      ) : (
                        <span className="admin-muted">Uncategorized</span>
                      )}
                    </span>
                    <span>{item.replies}</span>
                    <span>{item.views}</span>
                    <span className="admin-row-actions">
                      <Link
                        className="table-action"
                        href={`/discussions/${encodeURIComponent(item.id)}/edit`}
                      >
                        Edit
                      </Link>
                      <button
                        className="table-action danger-text"
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          setTarget(item);
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No discussions yet.</p>
                </div>
              )}
            </div>
          </section>
          <ConfirmDialog
            open={Boolean(target)}
            title="Delete this discussion?"
            message={`“${target?.title || ''}” and all of its replies will be permanently removed. This cannot be undone.`}
            confirmLabel="Delete discussion"
            busy={busy}
            error={message?.error ? message.text : ''}
            onConfirm={remove}
            onCancel={() => {
              setTarget(null);
              setMessage(null);
            }}
          />
        </>
      )}
    </AdminPage>
  );
}

function TagRow({
  tag,
  busy,
  save,
}: {
  tag: AdminTag;
  busy: boolean;
  save: (tag: AdminTag | null, values: { name: string; slug: string; color: string }) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [slug, setSlug] = useState(tag.slug);
  const [color, setColor] = useState(tag.color);
  const dirty = name !== tag.name || slug !== tag.slug || color !== tag.color;

  return (
    <form
      className="tag-admin-row"
      onSubmit={(event) => {
        event.preventDefault();
        save(tag, { name, slug, color });
      }}
    >
      <ColorField label={`Color for ${tag.name}`} value={color} onChange={setColor} compact />
      <input
        aria-label={`Name for ${tag.name}`}
        value={name}
        minLength={2}
        maxLength={60}
        required
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Slug for ${tag.name}`}
        value={slug}
        required
        onChange={(event) => setSlug(event.target.value)}
      />
      <button className="table-action" type="submit" disabled={busy || !dirty}>
        Save
      </button>
    </form>
  );
}

export function TagsPanel() {
  const { reload } = useAdminData();
  const { busy, message, run } = useAdminAction();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [color, setColor] = useState('#e7672e');

  function save(tag: AdminTag | null, values: { name: string; slug: string; color: string }) {
    void run(
      async () => {
        await api(tag ? `/api/admin/tags/${encodeURIComponent(tag.id)}` : '/api/admin/tags', {
          method: tag ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...values, name: values.name.trim(), slug: slugify(values.slug) }),
        });
        await reload();
      },
      tag ? `${values.name.trim()} updated` : `${values.name.trim()} created`,
    ).then((ok) => {
      if (ok && !tag) {
        setName('');
        setSlug('');
        setSlugEdited(false);
      }
    });
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(null, { name, slug, color });
  }

  return (
    <AdminPage>
      {(data) => (
        <>
          <PageHeading
            eyebrow="Organization"
            title="Tags"
            copy="Shape how members browse and categorize discussions."
          />
          <ActionMessage message={message} />
          <section className="admin-grid-two">
            <form className="admin-card admin-form" onSubmit={create}>
              <h2>Create tag</h2>
              <label>
                <span>Name</span>
                <input
                  value={name}
                  minLength={2}
                  maxLength={60}
                  required
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!slugEdited) setSlug(slugify(event.target.value));
                  }}
                />
              </label>
              <label>
                <span>Slug</span>
                <input
                  value={slug}
                  required
                  onChange={(event) => {
                    setSlug(event.target.value);
                    setSlugEdited(true);
                  }}
                />
              </label>
              <ColorField label="Color" value={color} onChange={setColor} />
              <button className="button button-primary" type="submit" disabled={busy}>
                Create tag
              </button>
            </form>
            <div className="admin-card">
              <h2>Existing tags</h2>
              <div className="tag-admin-list">
                {data.tags.length ? (
                  data.tags.map((tag) => (
                    <TagRow
                      key={`${tag.id}-${tag.name}-${tag.slug}-${tag.color}`}
                      tag={tag}
                      busy={busy}
                      save={save}
                    />
                  ))
                ) : (
                  <p className="admin-muted">No tags yet.</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminPage>
  );
}

function reportTarget(report: AdminReport) {
  if (report.discussion_id) {
    return (
      <Link href={`/discussions/${encodeURIComponent(report.discussion_id)}`}>View discussion</Link>
    );
  }
  return report.post_id ? <span>Post {report.post_id.slice(0, 8)}</span> : null;
}

export function ModerationPanel() {
  const { reload } = useAdminData();
  const { busy, message, run } = useAdminAction();
  const [showHandled, setShowHandled] = useState(false);

  function act(report: AdminReport, action: 'dismiss' | 'remove') {
    void run(
      async () => {
        await api(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        });
        await reload();
      },
      action === 'dismiss' ? 'Report dismissed' : 'Content hidden and report resolved',
    );
  }

  return (
    <AdminPage>
      {(data) => {
        const open = data.reports.filter((report) => !report.status || report.status === 'open');
        const reports = showHandled ? data.reports : open;
        return (
          <>
            <PageHeading
              eyebrow="Safety"
              title="Moderation queue"
              copy="Review member reports and keep conversations constructive."
              action={
                <button className="button" type="button" onClick={() => setShowHandled((v) => !v)}>
                  {showHandled ? 'Show open only' : 'Show handled reports'}
                </button>
              }
            />
            <ActionMessage message={message} />
            <section className="admin-card">
              <div className="report-list">
                {reports.length ? (
                  reports.map((report) => {
                    const isOpen = !report.status || report.status === 'open';
                    return (
                      <article key={report.id}>
                        <div>
                          <span>{report.status || 'open'}</span>
                          <strong>{report.reason || 'Community report'}</strong>
                          <small>
                            {report.created_at
                              ? new Date(report.created_at).toLocaleString()
                              : 'Recently submitted'}{' '}
                            · {reportTarget(report)}
                          </small>
                        </div>
                        {isOpen ? (
                          <div>
                            <button
                              className="button"
                              type="button"
                              disabled={busy}
                              onClick={() => act(report, 'dismiss')}
                            >
                              Dismiss
                            </button>
                            <button
                              className="button danger-text"
                              type="button"
                              disabled={busy}
                              onClick={() => act(report, 'remove')}
                            >
                              Hide content
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <h3>Queue is clear</h3>
                    <p>There are no reports waiting for review.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        );
      }}
    </AdminPage>
  );
}
