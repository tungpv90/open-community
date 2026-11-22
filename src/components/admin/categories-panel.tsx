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
import type { AdminCategory } from '@/components/admin/admin-data';
import { ColorField } from '@/components/admin/form-controls';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/utils/api/client';

type CategoryValues = { name: string; slug: string; description: string; color: string };

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function CategoryRow({
  category,
  busy,
  save,
  remove,
}: {
  category: AdminCategory;
  busy: boolean;
  save: (category: AdminCategory, values: CategoryValues) => void;
  remove: (category: AdminCategory) => void;
}) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [description, setDescription] = useState(category.description || '');
  const [color, setColor] = useState(category.color);
  const dirty =
    name !== category.name ||
    slug !== category.slug ||
    description !== (category.description || '') ||
    color !== category.color;
  const count = category.discussion_count ?? 0;

  return (
    <form
      className="category-admin-row"
      onSubmit={(event) => {
        event.preventDefault();
        save(category, { name, slug, description, color });
      }}
    >
      <ColorField label={`Color for ${category.name}`} value={color} onChange={setColor} compact />
      <input
        aria-label={`Name for ${category.name}`}
        value={name}
        minLength={2}
        maxLength={60}
        required
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Slug for ${category.name}`}
        value={slug}
        required
        onChange={(event) => setSlug(event.target.value)}
      />
      <span className="admin-row-actions">
        <button className="table-action" type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <button
          className="table-action danger-text"
          type="button"
          disabled={busy}
          onClick={() => remove(category)}
        >
          Delete
        </button>
      </span>
      <input
        className="category-admin-description"
        aria-label={`Description for ${category.name}`}
        placeholder="Description (optional)"
        value={description}
        maxLength={300}
        onChange={(event) => setDescription(event.target.value)}
      />
      <small className="category-admin-count">
        {count === 1 ? '1 discussion' : `${count} discussions`}
      </small>
    </form>
  );
}

export function CategoriesPanel() {
  const { reload } = useAdminData();
  const { busy, message, setMessage, run } = useAdminAction();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#e7672e');
  const [target, setTarget] = useState<AdminCategory | null>(null);

  function save(category: AdminCategory | null, values: CategoryValues) {
    const label = values.name.trim();
    void run(
      async () => {
        await api(
          category
            ? `/api/admin/categories/${encodeURIComponent(category.id)}`
            : '/api/admin/categories',
          {
            method: category ? 'PATCH' : 'POST',
            body: JSON.stringify({
              name: label,
              slug: slugify(values.slug),
              description: values.description.trim(),
              color: values.color,
            }),
          },
        );
        await reload();
      },
      category ? `${label} updated` : `${label} created`,
    ).then((ok) => {
      if (ok && !category) {
        setName('');
        setSlug('');
        setSlugEdited(false);
        setDescription('');
      }
    });
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(null, { name, slug, description, color });
  }

  async function confirmDelete() {
    if (!target) return;
    const removed = target;
    const ok = await run(async () => {
      await api(`/api/admin/categories/${encodeURIComponent(removed.id)}`, { method: 'DELETE' });
      await reload();
    }, `${removed.name} deleted`);
    if (ok) setTarget(null);
  }

  return (
    <AdminPage>
      {(data) => (
        <>
          <PageHeading
            eyebrow="Organization"
            title="Categories"
            copy="Every discussion belongs to one category. Members choose it when they start a discussion."
          />
          {target ? null : <ActionMessage message={message} />}
          <section className="admin-grid-two">
            <form className="admin-card admin-form" onSubmit={create}>
              <h2>Create category</h2>
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
              <label>
                <span>Description</span>
                <input
                  value={description}
                  maxLength={300}
                  placeholder="What belongs in this category?"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <ColorField label="Color" value={color} onChange={setColor} />
              <button className="button button-primary" type="submit" disabled={busy}>
                Create category
              </button>
            </form>
            <div className="admin-card">
              <h2>Existing categories</h2>
              <div className="tag-admin-list">
                {data.categories.length ? (
                  data.categories.map((category) => (
                    <CategoryRow
                      key={`${category.id}-${category.name}-${category.slug}-${category.color}-${category.description}`}
                      category={category}
                      busy={busy}
                      save={save}
                      remove={(item) => {
                        setMessage(null);
                        setTarget(item);
                      }}
                    />
                  ))
                ) : (
                  <p className="admin-muted">
                    No categories yet. Members cannot start discussions until one exists.
                  </p>
                )}
              </div>
            </div>
          </section>
          <ConfirmDialog
            open={Boolean(target)}
            title="Delete this category?"
            message={
              target?.discussion_count
                ? `“${target.name}” still has ${target.discussion_count} discussion(s). Move or delete them first.`
                : `“${target?.name || ''}” will be permanently removed.`
            }
            confirmLabel="Delete category"
            busy={busy}
            error={message?.error ? message.text : ''}
            onConfirm={confirmDelete}
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
