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
import type { AdminGroup } from '@/components/admin/admin-data';
import { ColorField } from '@/components/admin/form-controls';
import { api } from '@/utils/api/client';

function GroupRow({
  group,
  busy,
  save,
}: {
  group: AdminGroup;
  busy: boolean;
  save: (group: AdminGroup | null, name: string, color: string) => void;
}) {
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color || '#667d99');
  const dirty = name.trim() !== group.name || color !== group.color;

  return (
    <form
      className="tag-admin-row tag-admin-row-compact"
      onSubmit={(event) => {
        event.preventDefault();
        save(group, name, color);
      }}
    >
      <ColorField label={`Color for ${group.name}`} value={color} onChange={setColor} compact />
      <input
        aria-label={`Name for ${group.name}`}
        value={name}
        minLength={2}
        maxLength={60}
        required
        onChange={(event) => setName(event.target.value)}
      />
      <button className="table-action" type="submit" disabled={busy || !dirty}>
        Save
      </button>
    </form>
  );
}

export function GroupsPanel() {
  const { reload } = useAdminData();
  const { busy, message, run } = useAdminAction();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#667d99');

  function save(group: AdminGroup | null, groupName: string, groupColor: string) {
    void run(
      async () => {
        await api(
          group ? `/api/admin/groups/${encodeURIComponent(group.id)}` : '/api/admin/groups',
          {
            method: group ? 'PATCH' : 'POST',
            body: JSON.stringify({ name: groupName.trim(), color: groupColor }),
          },
        );
        await reload();
      },
      group ? `${groupName.trim()} updated` : `${groupName.trim()} created`,
    ).then((ok) => {
      if (ok && !group) setName('');
    });
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(null, name, color);
  }

  return (
    <AdminPage>
      {(data) => (
        <>
          <PageHeading
            eyebrow="People"
            title="Groups"
            copy="Organize members into named, color-coded groups."
          />
          <ActionMessage message={message} />
          <section className="admin-grid-two">
            <form className="admin-card admin-form" onSubmit={create}>
              <h2>Create group</h2>
              <label>
                <span>Name</span>
                <input
                  value={name}
                  minLength={2}
                  maxLength={60}
                  required
                  placeholder="e.g. Contributors"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <ColorField label="Color" value={color} onChange={setColor} />
              <button className="button button-primary" type="submit" disabled={busy}>
                Create group
              </button>
            </form>
            <div className="admin-card">
              <h2>Existing groups</h2>
              <div className="tag-admin-list">
                {data.groups.length ? (
                  data.groups.map((group) => (
                    <GroupRow
                      key={`${group.id}-${group.name}-${group.color}`}
                      group={group}
                      busy={busy}
                      save={save}
                    />
                  ))
                ) : (
                  <p className="admin-muted">No groups yet.</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminPage>
  );
}
