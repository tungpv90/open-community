'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  ActionMessage,
  AdminPage,
  PageHeading,
  useAdminAction,
  useAdminData,
} from '@/components/admin/admin-data';
import type { AdminUser } from '@/components/admin/admin-data';
import { useCommunity } from '@/components/session/community-provider';
import { api } from '@/utils/api/client';

function userName(user: AdminUser) {
  return user.display_name || user.username || user.email?.split('@')[0] || 'Member';
}

function UserRow({
  user,
  isSelf,
  busy,
  update,
}: {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  update: (user: AdminUser, patch: Record<string, string>, success: string) => void;
}) {
  const [name, setName] = useState(userName(user));
  const dirty = name.trim() !== userName(user);

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty) update(user, { display_name: name.trim() }, `${name.trim()} renamed`);
  }

  return (
    <div className="table-row">
      <span className="user-cell">
        <form className="admin-inline-form" onSubmit={saveName}>
          <input
            aria-label={`Display name for ${user.email || userName(user)}`}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
          {dirty ? (
            <button className="table-action" type="submit" disabled={busy}>
              Save
            </button>
          ) : null}
        </form>
        <small>{user.email || `@${user.username}`}</small>
      </span>
      <span>
        <select
          aria-label={`Role for ${userName(user)}`}
          value={user.role || 'member'}
          disabled={busy || isSelf}
          title={isSelf ? 'You cannot change your own role' : undefined}
          onChange={(event) =>
            update(
              user,
              { role: event.target.value },
              `${userName(user)} is now ${event.target.value}`,
            )
          }
        >
          <option value="member">Member</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
      </span>
      <span>
        <select
          aria-label={`Status for ${userName(user)}`}
          value={user.status || 'active'}
          disabled={busy || isSelf}
          onChange={(event) =>
            update(
              user,
              { status: event.target.value },
              `${userName(user)} is now ${event.target.value}`,
            )
          }
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </span>
      <span>{user.joined_at ? new Date(user.joined_at).toLocaleDateString() : '—'}</span>
      <span>
        {user.email_confirmed_at ? (
          <em>Confirmed</em>
        ) : (
          <button
            className="table-action"
            type="button"
            disabled={busy}
            onClick={() => update(user, {}, `${userName(user)} confirmed`)}
          >
            Confirm email
          </button>
        )}
      </span>
    </div>
  );
}

export function UsersPanel() {
  const { reload } = useAdminData();
  const { user: currentUser } = useCommunity();
  const { busy, message, run } = useAdminAction();
  const [query, setQuery] = useState('');

  function update(user: AdminUser, patch: Record<string, string>, success: string) {
    const encoded = encodeURIComponent(user.id);
    void run(async () => {
      if (Object.keys(patch).length) {
        await api(`/api/admin/users/${encoded}`, { method: 'PATCH', body: JSON.stringify(patch) });
      } else {
        await api(`/api/admin/users/${encoded}/confirm`, { method: 'POST', body: '{}' });
      }
      await reload();
    }, success);
  }

  return (
    <AdminPage>
      {(data) => {
        const needle = query.trim().toLowerCase();
        const users = needle
          ? data.users.filter((user) =>
              [user.email, user.username, user.display_name]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle)),
            )
          : data.users;
        return (
          <>
            <PageHeading
              eyebrow="People"
              title="Users"
              copy="Manage member identities, permissions, and account status."
            />
            <ActionMessage message={message} />
            <section className="admin-card table-card">
              <div className="table-toolbar">
                <strong>
                  {users.length === data.users.length
                    ? `${data.users.length} users`
                    : `${users.length} of ${data.users.length} users`}
                </strong>
                <input
                  type="search"
                  placeholder="Search by name or email"
                  aria-label="Search users"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="admin-table">
                <div className="table-row table-head">
                  <span>User</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Joined</span>
                  <span>Email</span>
                </div>
                {users.map((user) => (
                  <UserRow
                    key={`${user.id}-${user.display_name}`}
                    user={user}
                    isSelf={user.id === currentUser?.id}
                    busy={busy}
                    update={update}
                  />
                ))}
                {!users.length ? (
                  <div className="empty-state">
                    <p>No users match “{query}”.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        );
      }}
    </AdminPage>
  );
}
