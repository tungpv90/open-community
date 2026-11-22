'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  ActionMessage,
  AdminPage,
  PageHeading,
  useAdminAction,
  useAdminData,
} from '@/components/admin/admin-data';
import type { AdminReport } from '@/components/admin/admin-data';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RelativeTime } from '@/components/ui/relative-time';
import { normalizeDiscussion } from '@/lib/forum';
import type { ForumDiscussion } from '@/lib/forum';
import { api, errorMessage } from '@/utils/api/client';

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
                        by {item.author.name} · <RelativeTime value={item.createdIso} />
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
