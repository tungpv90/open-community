'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCommunity } from '@/components/session/community-provider';
import { api, errorMessage } from '@/utils/api/client';

type Notification = {
  id: string;
  type?: string;
  message?: string;
  discussion_id?: string | null;
  created_at?: string;
  is_read?: boolean;
};

const typeLabels: Record<string, string> = {
  reply: 'New reply',
  like: 'New like',
};

export function NotificationsPage() {
  const router = useRouter();
  const { ready, user } = useCommunity();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login?next=/notifications');
      return;
    }
    api<{ notifications: Notification[] }>('/api/notifications')
      .then((result) => setNotifications(result.notifications))
      .catch((loadError) => setError(errorMessage(loadError, 'Could not load notifications')))
      .finally(() => setLoading(false));
  }, [ready, router, user]);

  async function markRead() {
    try {
      await api('/api/notifications', { method: 'PATCH', body: '{}' });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (markError) {
      setError(errorMessage(markError, 'Could not mark notifications as read'));
    }
  }

  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <main className="content-page notifications-page">
      <header className="simple-heading">
        <div>
          <p>Your account</p>
          <h1>Notifications</h1>
          <span>Replies and likes on discussions you started or follow.</span>
        </div>
        <button className="button" type="button" onClick={markRead} disabled={!unread}>
          Mark all as read
        </button>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="notification-list" aria-busy={loading}>
        {loading ? (
          <div className="empty-state">
            <p>Loading notifications…</p>
          </div>
        ) : notifications.length ? (
          notifications.map((item) => {
            const body = (
              <>
                <i aria-hidden="true">{item.type === 'like' ? '♥' : '♢'}</i>
                <div>
                  <strong>{typeLabels[item.type || ''] || 'Community update'}</strong>
                  <p>{item.message || 'There is new activity in the community.'}</p>
                  <small>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}
                  </small>
                </div>
              </>
            );
            return (
              <article className={item.is_read ? '' : 'unread'} key={item.id}>
                {item.discussion_id ? (
                  <Link
                    className="notification-link"
                    href={`/discussions/${encodeURIComponent(item.discussion_id)}`}
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            <h3>You are all caught up</h3>
            <p>New replies and likes will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
